namespace juce
{

EM_JS (int, juce_web_createGLCanvas, (int peerId, int glId), {
    var W = Module.juceWeb;
    if (! W || ! W.peers[peerId])
        return 0;
    var peer = W.peers[peerId];
    var canvas = document.createElement ("canvas");
    canvas.id = "juce-gl-" + glId;
    canvas.style.position = "absolute";
    canvas.style.left = "0px";
    canvas.style.top = "0px";
    canvas.style.width = "1px";
    canvas.style.height = "1px";
    canvas.style.pointerEvents = "none";
    canvas.width = 1;
    canvas.height = 1;
    canvas.addEventListener ("webglcontextlost", function (e) { e.preventDefault(); }, false);
    peer.div.appendChild (canvas);
    W.glCanvases = W.glCanvases || {};
    W.glCanvases[glId] = canvas;
    return 1;
});

EM_JS (void, juce_web_destroyGLCanvas, (int glId), {
    var W = Module.juceWeb;
    if (! W || ! W.glCanvases || ! W.glCanvases[glId])
        return;
    var canvas = W.glCanvases[glId];
    if (canvas.parentNode)
        canvas.parentNode.removeChild (canvas);
    delete W.glCanvases[glId];
});

EM_JS (void, juce_web_setGLCanvasBounds, (int glId, int x, int y, int w, int h, int pw, int ph), {
    var W = Module.juceWeb;
    if (! W || ! W.glCanvases || ! W.glCanvases[glId])
        return;
    var canvas = W.glCanvases[glId];
    canvas.style.left = x + "px";
    canvas.style.top = y + "px";
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    if (canvas.width != pw) canvas.width = pw;
    if (canvas.height != ph) canvas.height = ph;
});

EM_JS (void, juce_web_readBufferSubData, (int target, int offset, int length, void* dest), {
    var tmp = new Uint8Array (length);
    GLctx.getBufferSubData (target, offset, tmp);
    HEAPU8.set (tmp, dest);
});

class OpenGLContext::NativeContext
{
public:
    NativeContext (Component& comp,
                   const OpenGLPixelFormat& pixelFormat,
                   void*,
                   bool useMultisampling,
                   OpenGLVersion)
        : component (comp), glId (nextId()++)
    {
        auto* peer = component.getPeer();
        jassert (peer != nullptr);

        if (peer == nullptr)
            return;

        auto peerId = (int) (pointer_sized_int) peer->getNativeHandle();

        if (juce_web_createGLCanvas (peerId, glId) == 0)
            return;

        canvasCreated = true;

        EmscriptenWebGLContextAttributes attrs;
        emscripten_webgl_init_context_attributes (&attrs);
        attrs.majorVersion = 2;
        attrs.minorVersion = 0;
        attrs.alpha = pixelFormat.alphaBits > 0;
        attrs.depth = pixelFormat.depthBufferBits > 0;
        attrs.stencil = pixelFormat.stencilBufferBits > 0;
        attrs.antialias = useMultisampling;
        attrs.premultipliedAlpha = true;
        attrs.preserveDrawingBuffer = false;
        attrs.enableExtensionsByDefault = 1;
        attrs.powerPreference = EM_WEBGL_POWER_PREFERENCE_HIGH_PERFORMANCE;

        auto selector = "#juce-gl-" + String (glId);
        renderContext = emscripten_webgl_create_context (selector.toRawUTF8(), &attrs);

        if (renderContext <= 0)
        {
            attrs.antialias = false;
            renderContext = emscripten_webgl_create_context (selector.toRawUTF8(), &attrs);
        }

        updateWindowPosition (peer->getAreaCoveredBy (component));
    }

    ~NativeContext()
    {
        if (renderContext > 0)
        {
            if (emscripten_webgl_get_current_context() == renderContext)
                emscripten_webgl_make_context_current (0);

            emscripten_webgl_destroy_context (renderContext);
        }

        if (canvasCreated)
            juce_web_destroyGLCanvas (glId);
    }

    bool initialiseOnRenderThread (OpenGLContext& c)
    {
        context = &c;
        return renderContext > 0 && c.makeActive();
    }

    void shutdownOnRenderThread()
    {
        context = nullptr;
        deactivateCurrentContext();
    }

    bool makeActive() const noexcept
    {
        return renderContext > 0
                && emscripten_webgl_make_context_current (renderContext) == EMSCRIPTEN_RESULT_SUCCESS;
    }

    bool isActive() const noexcept
    {
        return renderContext > 0 && emscripten_webgl_get_current_context() == renderContext;
    }

    static void deactivateCurrentContext()
    {
        emscripten_webgl_make_context_current (0);
    }

    void swapBuffers() {}

    void updateWindowPosition (Rectangle<int> newBounds)
    {
        bounds = newBounds;
        auto scale = Desktop::getInstance().getDisplays().getPrimaryDisplay()->scale;
        juce_web_setGLCanvasBounds (glId, bounds.getX(), bounds.getY(), bounds.getWidth(), bounds.getHeight(),
                                    jmax (1, roundToInt (bounds.getWidth() * scale)),
                                    jmax (1, roundToInt (bounds.getHeight() * scale)));
    }

    bool setSwapInterval (int numFramesPerSwap)    { swapFrames = numFramesPerSwap; return true; }
    int getSwapInterval() const                     { return swapFrames; }
    bool createdOk() const noexcept                 { return renderContext > 0; }
    void* getRawContext() const noexcept            { return (void*) (pointer_sized_int) renderContext; }
    GLuint getFrameBufferID() const noexcept        { return 0; }

    void triggerRepaint()
    {
        if (context != nullptr)
            context->triggerRepaint();
    }

    struct Locker { Locker (NativeContext&) {} };

private:
    static int& nextId()
    {
        static int id = 1;
        return id;
    }

    Component& component;
    const int glId;
    EMSCRIPTEN_WEBGL_CONTEXT_HANDLE renderContext = 0;
    OpenGLContext* context = nullptr;
    Rectangle<int> bounds;
    int swapFrames = 1;
    bool canvasCreated = false;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (NativeContext)
};

bool OpenGLHelpers::isContextActive()
{
    return emscripten_webgl_get_current_context() > 0;
}

}

#undef glMapBufferRange
#undef glUnmapBuffer

namespace
{
    struct WebMappedBuffer
    {
        GLenum target = 0;
        void* data = nullptr;
        bool readOnly = false;
    };

    static std::vector<WebMappedBuffer>& getWebMappedBuffers()
    {
        static std::vector<WebMappedBuffer> buffers;
        return buffers;
    }
}

extern "C" void* juce_web_glMapBufferRange (GLenum target, GLintptr offset, GLsizeiptr length, GLbitfield access)
{
    if ((access & GL_MAP_READ_BIT) != 0)
    {
        auto* data = malloc ((size_t) juce::jmax ((GLsizeiptr) 4, length));
        juce::juce_web_readBufferSubData ((int) target, (int) offset, (int) length, data);
        getWebMappedBuffers().push_back ({ target, data, true });
        return data;
    }

    auto* result = glMapBufferRange (target, offset, length, access);
    getWebMappedBuffers().push_back ({ target, result, false });
    return result;
}

extern "C" GLboolean juce_web_glUnmapBuffer (GLenum target)
{
    auto& buffers = getWebMappedBuffers();

    for (auto it = buffers.rbegin(); it != buffers.rend(); ++it)
    {
        if (it->target == target)
        {
            auto entry = *it;
            buffers.erase (std::next (it).base());

            if (entry.readOnly)
            {
                free (entry.data);
                return GL_TRUE;
            }

            return glUnmapBuffer (target);
        }
    }

    return glUnmapBuffer (target);
}
