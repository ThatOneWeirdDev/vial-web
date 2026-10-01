namespace juce
{

namespace EmscriptenMessaging
{
    static CriticalSection queueLock;
    static std::deque<MessageManager::MessageBase*> queue;
    static std::atomic<bool> dispatchScheduled { false };
    static bool dispatching = false;
    static bool initialised = false;

    struct FrameCallback
    {
        void* owner;
        std::function<void (double)> callback;
    };

    static std::vector<FrameCallback> frameCallbacks;
    static std::vector<FrameCallback> pendingFrameCallbacks;
    static bool iteratingFrameCallbacks = false;

    static void dispatchPending()
    {
        dispatchScheduled = false;

        if (dispatching)
            return;

        dispatching = true;

        std::deque<MessageManager::MessageBase*> current;

        {
            const ScopedLock sl (queueLock);
            current.swap (queue);
        }

        while (! current.empty())
        {
            auto* message = current.front();
            current.pop_front();

            JUCE_TRY
            {
                message->messageCallback();
            }
            JUCE_CATCH_EXCEPTION

            message->decReferenceCount();
        }

        dispatching = false;
    }

    static void runFrame (double timestamp)
    {
        dispatchPending();

        iteratingFrameCallbacks = true;

        for (size_t i = 0; i < frameCallbacks.size(); ++i)
        {
            if (frameCallbacks[i].callback != nullptr)
            {
                JUCE_TRY
                {
                    frameCallbacks[i].callback (timestamp);
                }
                JUCE_CATCH_EXCEPTION
            }
        }

        iteratingFrameCallbacks = false;

        frameCallbacks.erase (std::remove_if (frameCallbacks.begin(), frameCallbacks.end(),
                                              [] (const FrameCallback& f) { return f.callback == nullptr; }),
                              frameCallbacks.end());

        for (auto& f : pendingFrameCallbacks)
            frameCallbacks.push_back (std::move (f));

        pendingFrameCallbacks.clear();
    }

    static void mainLoopIteration()
    {
        runFrame (emscripten_get_now());
    }
}

extern "C" EMSCRIPTEN_KEEPALIVE void juce_emscriptenDispatchMessages()
{
    EmscriptenMessaging::dispatchPending();
}

void EmscriptenEventLoop::scheduleDispatch()
{
    if (EmscriptenMessaging::dispatchScheduled.exchange (true))
        return;

    if (emscripten_is_main_runtime_thread())
    {
        EM_ASM ({
            if (Module.juceScheduleDispatch)
                Module.juceScheduleDispatch();
            else
                setTimeout (function() { Module._juce_emscriptenDispatchMessages(); }, 0);
        });
    }
    else
    {
        MAIN_THREAD_ASYNC_EM_ASM ({
            if (Module.juceScheduleDispatch)
                Module.juceScheduleDispatch();
            else
                setTimeout (function() { Module._juce_emscriptenDispatchMessages(); }, 0);
        });
    }
}

bool EmscriptenEventLoop::isDispatching()
{
    return EmscriptenMessaging::dispatching;
}

void EmscriptenEventLoop::addFrameCallback (void* owner, std::function<void (double)> callback)
{
    jassert (MessageManager::getInstance()->isThisTheMessageThread());

    if (EmscriptenMessaging::iteratingFrameCallbacks)
        EmscriptenMessaging::pendingFrameCallbacks.push_back ({ owner, std::move (callback) });
    else
        EmscriptenMessaging::frameCallbacks.push_back ({ owner, std::move (callback) });
}

void EmscriptenEventLoop::removeFrameCallback (void* owner)
{
    for (auto& f : EmscriptenMessaging::frameCallbacks)
        if (f.owner == owner)
            f.callback = nullptr;

    auto& pending = EmscriptenMessaging::pendingFrameCallbacks;
    pending.erase (std::remove_if (pending.begin(), pending.end(),
                                   [owner] (const EmscriptenMessaging::FrameCallback& f) { return f.owner == owner; }),
                   pending.end());

    if (! EmscriptenMessaging::iteratingFrameCallbacks)
    {
        auto& callbacks = EmscriptenMessaging::frameCallbacks;
        callbacks.erase (std::remove_if (callbacks.begin(), callbacks.end(),
                                         [] (const EmscriptenMessaging::FrameCallback& f) { return f.callback == nullptr; }),
                         callbacks.end());
    }
}

void MessageManager::doPlatformSpecificInitialisation()
{
    if (EmscriptenMessaging::initialised)
        return;

    EmscriptenMessaging::initialised = true;

    EM_ASM ({
        var channel = new MessageChannel();
        channel.port1.onmessage = function() { Module._juce_emscriptenDispatchMessages(); };
        Module.juceScheduleDispatch = function() { channel.port2.postMessage (0); };
    });
}

void MessageManager::doPlatformSpecificShutdown()
{
}

bool MessageManager::postMessageToSystemQueue (MessageManager::MessageBase* const message)
{
    message->incReferenceCount();

    {
        const ScopedLock sl (EmscriptenMessaging::queueLock);
        EmscriptenMessaging::queue.push_back (message);
    }

    EmscriptenEventLoop::scheduleDispatch();
    return true;
}

void MessageManager::broadcastMessage (const String&)
{
}

bool MessageManager::dispatchNextMessageOnSystemQueue (bool)
{
    EmscriptenMessaging::dispatchPending();
    return false;
}

class MessageManager::QuitMessage   : public MessageManager::MessageBase
{
public:
    QuitMessage() {}

    void messageCallback() override
    {
        if (auto* mm = MessageManager::instance)
            mm->quitMessageReceived = true;
    }

    JUCE_DECLARE_NON_COPYABLE (QuitMessage)
};

void MessageManager::runDispatchLoop()
{
    jassert (isThisTheMessageThread());
    emscripten_set_main_loop (EmscriptenMessaging::mainLoopIteration, 0, 0);
}

void MessageManager::stopDispatchLoop()
{
    (new QuitMessage())->post();
    quitMessagePosted = true;
}

}
