namespace juce
{

EM_JS (void, juce_web_openFileChooser, (int handle, const char* accept, int multiple, int directory, const char* importBase), {
    var W = Module.juceWeb;
    var base = UTF8ToString (importBase);
    var input = document.createElement ("input");
    input.type = "file";
    var acceptString = UTF8ToString (accept);
    var appleMobile = /iPad|iPhone|iPod/.test (navigator.userAgent) ||
                      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (acceptString.length > 0 && ! directory && ! appleMobile)
        input.accept = acceptString;
    if (multiple)
        input.multiple = true;
    if (directory)
    {
        input.webkitdirectory = true;
        input.setAttribute ("webkitdirectory", "");
        input.setAttribute ("directory", "");
    }
    input.style.position = "fixed";
    input.style.left = "-10000px";
    input.style.top = "0px";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";
    input.tabIndex = -1;
    document.body.appendChild (input);

    var finished = false;
    var prompt = null;
    var finish = function (paths) {
        if (finished)
            return;
        finished = true;
        if (input.parentNode)
            input.parentNode.removeChild (input);
        if (prompt && prompt.parentNode)
            prompt.parentNode.removeChild (prompt);
        var joined = paths.join (String.fromCharCode (10));
        var n = lengthBytesUTF8 (joined) + 1;
        var p = _malloc (n);
        stringToUTF8 (joined, p, n);
        Module._juce_web_fileChooserResult (handle, p);
        _free (p);
    };

    input.addEventListener ("change", function() {
        if (! input.files || input.files.length == 0)
        {
            finish ([]);
            return;
        }
        W.importFiles (input.files, directory ? base : "/tmp/juce-open", function (paths) {
            if (directory)
            {
                if (paths.length == 0) { finish ([]); return; }
                var first = paths[0];
                var rel = input.files[0].webkitRelativePath || input.files[0].name;
                var top = rel.split ("/")[0];
                var root = first.substring (0, first.length - rel.length) + top;
                finish ([root]);
            }
            else
            {
                finish (paths);
            }
        });
    });

    input.addEventListener ("cancel", function() { finish ([]); });

    var hasActivation = ! navigator.userActivation || navigator.userActivation.isActive;

    if (hasActivation)
    {
        input.click();
        return;
    }

    prompt = document.createElement ("div");
    prompt.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;" +
                           "justify-content:center;background:rgba(0,0,0,0.55);font-family:system-ui,sans-serif;";
    var box = document.createElement ("div");
    box.style.cssText = "background:#26292d;border:1px solid #3a3e44;border-radius:10px;padding:18px;" +
                        "display:flex;gap:10px;";
    var choose = document.createElement ("button");
    choose.textContent = directory ? "Choose folder" : (multiple ? "Choose files" : "Choose file");
    choose.style.cssText = "background:#aa88ff;color:#1d2125;border:0;border-radius:6px;padding:10px 18px;font-size:15px;";
    var cancel = document.createElement ("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText = "background:#4a4e54;color:#e6e7e9;border:0;border-radius:6px;padding:10px 18px;font-size:15px;";
    choose.addEventListener ("click", function (e) {
        e.stopPropagation();
        if (prompt && prompt.parentNode)
            prompt.parentNode.removeChild (prompt);
        input.click();
    });
    cancel.addEventListener ("click", function (e) { e.stopPropagation(); finish ([]); });
    ["pointerdown", "pointerup", "keydown"].forEach (function (type) {
        prompt.addEventListener (type, function (e) { e.stopPropagation(); });
    });
    box.appendChild (choose);
    box.appendChild (cancel);
    prompt.appendChild (box);
    document.body.appendChild (prompt);
});

EM_JS (void, juce_web_saveFileChooser, (int handle, const char* suggested, const char* accept, const char* dir), {
    var W = Module.juceWeb;
    W.saveHandles = W.saveHandles || {};
    var suggestedName = UTF8ToString (suggested);
    var acceptString = UTF8ToString (accept);
    var dirPath = UTF8ToString (dir);

    var mkdirs = function (path) {
        var parts = path.split ("/");
        var current = "";
        for (var i = 1; i < parts.length; ++i)
        {
            current += "/" + parts[i];
            try { FS.mkdir (current); } catch (err) {}
        }
    };

    var result = function (name) {
        var path = "";
        if (name && name.length > 0)
        {
            mkdirs (dirPath);
            path = dirPath + "/" + name.split ("/").join ("_").split (String.fromCharCode (92)).join ("_");
        }
        var n = lengthBytesUTF8 (path) + 1;
        var p = _malloc (n);
        stringToUTF8 (path, p, n);
        Module._juce_web_fileChooserResult (handle, p);
        _free (p);
    };

    var exts = acceptString.split (",").filter (function (e) { return e.length > 1 && e[0] == "."; });

    if (window.showSaveFilePicker && window.self === window.top)
    {
        var options = { suggestedName: suggestedName };
        if (exts.length > 0)
            options.types = [{ description: exts.join (", ") + " files", accept: { "application/octet-stream": exts } }];
        window.showSaveFilePicker (options).then (function (fileHandle) {
            W.saveHandles[handle] = fileHandle;
            result (fileHandle.name);
        }).catch (function (err) {
            if (err && err.name == "AbortError")
                result ("");
            else
            {
                var name = window.prompt ("Save as:", suggestedName);
                result (name || "");
            }
        });
    }
    else
    {
        var name = window.prompt ("Save as:", suggestedName);
        result (name || "");
    }
});

EM_JS (void, juce_web_finishSave, (int handle, const char* dir, const char* expected), {
    var W = Module.juceWeb;
    var dirPath = UTF8ToString (dir);
    var expectedName = UTF8ToString (expected);
    var fileHandle = W.saveHandles ? W.saveHandles[handle] : null;
    if (W.saveHandles)
        delete W.saveHandles[handle];

    var entries = [];
    try {
        entries = FS.readdir (dirPath).filter (function (n) { return n != "." && n != ".."; });
    } catch (err) {
        return;
    }

    var chosen = null;
    if (entries.indexOf (expectedName) >= 0)
    {
        chosen = expectedName;
    }
    else
    {
        var newest = -1;
        entries.forEach (function (n) {
            try {
                var st = FS.stat (dirPath + "/" + n);
                if (FS.isFile (st.mode) && st.mtime.getTime() >= newest)
                {
                    newest = st.mtime.getTime();
                    chosen = n;
                }
            } catch (err) {}
        });
    }

    if (chosen === null)
        return;

    var data = FS.readFile (dirPath + "/" + chosen);
    var copy = new Uint8Array (data.length);
    copy.set (data);

    var cleanup = function() {
        entries.forEach (function (n) { try { FS.unlink (dirPath + "/" + n); } catch (err) {} });
        try { FS.rmdir (dirPath); } catch (err) {}
    };

    if (fileHandle && fileHandle.createWritable)
    {
        fileHandle.createWritable().then (function (writable) {
            return writable.write (copy).then (function() { return writable.close(); });
        }).then (cleanup).catch (function (err) {
            console.error (err);
            cleanup();
        });
    }
    else
    {
        var blob = new Blob ([copy], { type: "application/octet-stream" });
        var url = URL.createObjectURL (blob);
        var a = document.createElement ("a");
        a.href = url;
        a.download = chosen;
        a.style.display = "none";
        document.body.appendChild (a);
        a.click();
        setTimeout (function() {
            URL.revokeObjectURL (url);
            if (a.parentNode) a.parentNode.removeChild (a);
            cleanup();
        }, 2000);
    }
});

static String filtersToAccept (const String& filters)
{
    StringArray tokens;
    tokens.addTokens (filters, ";,", "\"'");
    tokens.trim();
    tokens.removeEmptyStrings();

    StringArray extensions;

    for (auto& t : tokens)
    {
        if (t == "*" || t == "*.*")
            return {};

        auto ext = t.fromLastOccurrenceOf ("*", false, false).trim();

        if (ext.startsWithChar ('.') && ext.length() > 1)
            extensions.addIfNotAlreadyThere (ext.toLowerCase());
    }

    return extensions.joinIntoString (",");
}

class FileChooser::Native    : public FileChooser::Pimpl
{
public:
    Native (FileChooser& fileChooser, int flags)
        : owner (fileChooser),
          isDirectory         ((flags & FileBrowserComponent::canSelectDirectories)   != 0),
          isSave              ((flags & FileBrowserComponent::saveMode)               != 0),
          selectMultipleFiles ((flags & FileBrowserComponent::canSelectMultipleItems) != 0),
          handle (nextHandle()++)
    {
    }

    ~Native() override
    {
        getActive().erase (handle);
    }

    void launch() override
    {
        getActive()[handle] = this;
        auto accept = filtersToAccept (owner.filters);

        if (isSave)
        {
            saveDir = "/tmp/juce-save/" + String (handle) + "_" + String (Time::currentTimeMillis());
            auto suggested = owner.startingFile.getFileName();

            if (suggested.isEmpty() || owner.startingFile.isDirectory())
            {
                suggested = "Untitled";
                auto firstExt = accept.upToFirstOccurrenceOf (",", false, false);

                if (firstExt.isNotEmpty())
                    suggested += firstExt;
            }

            juce_web_saveFileChooser (handle, suggested.toRawUTF8(), accept.toRawUTF8(), saveDir.toRawUTF8());
        }
        else
        {
            auto importBase = File::getSpecialLocation (File::userDocumentsDirectory).getChildFile ("Imported");
            importBase.createDirectory();
            juce_web_openFileChooser (handle, accept.toRawUTF8(), selectMultipleFiles ? 1 : 0, isDirectory ? 1 : 0,
                                      importBase.getFullPathName().toRawUTF8());
        }
    }

    void runModally() override
    {
        jassertfalse;
        launch();
    }

    static void handleResult (int handle, const String& data)
    {
        auto it = getActive().find (handle);

        if (it == getActive().end())
            return;

        auto* self = it->second;
        getActive().erase (it);

        Array<URL> results;

        for (auto& path : StringArray::fromLines (data))
            if (path.isNotEmpty())
                results.add (URL (File (path)));

        auto wasSave = self->isSave;
        auto dir = self->saveDir;
        auto expected = results.isEmpty() ? String() : results.getFirst().getLocalFile().getFileName();
        auto& chooser = self->owner;

        chooser.finished (results);

        if (wasSave && ! results.isEmpty())
            juce_web_finishSave (handle, dir.toRawUTF8(), expected.toRawUTF8());
    }

private:
    static std::map<int, Native*>& getActive()
    {
        static std::map<int, Native*> active;
        return active;
    }

    static int& nextHandle()
    {
        static int h = 1;
        return h;
    }

    FileChooser& owner;
    bool isDirectory, isSave, selectMultipleFiles;
    int handle;
    String saveDir;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Native)
};

bool FileChooser::isPlatformDialogAvailable()
{
    return true;
}

FileChooser::Pimpl* FileChooser::showPlatformDialog (FileChooser& owner, int flags, FilePreviewComponent*)
{
    juce_web_setup();
    return new Native (owner, flags);
}

}

extern "C" EMSCRIPTEN_KEEPALIVE void juce_web_fileChooserResult (int handle, const char* data)
{
    juce::FileChooser::Native::handleResult (handle, juce::String::fromUTF8 (data));
}
