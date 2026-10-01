namespace juce
{

EM_JS (void, juce_webmidi_init, (), {
    var M = Module.juceMidi;
    if (M)
        return;

    M = Module.juceMidi = { access: null, inputs: [], outputs: [], openInputs: {}, requested: false };

    M.refresh = function() {
        var ins = [];
        var outs = [];
        if (M.access)
        {
            M.access.inputs.forEach (function (port) { ins.push ({ id: port.id, name: port.name || port.id, port: port }); });
            M.access.outputs.forEach (function (port) { outs.push ({ id: port.id, name: port.name || port.id, port: port }); });
        }
        M.inputs = ins;
        M.outputs = outs;
        for (var handle in M.openInputs)
            M.attach (parseInt (handle));
    };

    M.attach = function (handle) {
        var entry = M.openInputs[handle];
        if (! entry || ! M.access)
            return;
        var port = null;
        M.access.inputs.forEach (function (p) { if (p.id == entry.id) port = p; });
        if (! port || port === entry.port)
            return;
        if (entry.port)
            entry.port.onmidimessage = null;
        entry.port = port;
        port.onmidimessage = function (e) {
            if (! entry.active)
                return;
            var data = e.data;
            var p = _malloc (data.length);
            HEAPU8.set (data, p);
            Module._juce_webmidi_message (handle, p, data.length);
            _free (p);
        };
    };

    var request = function() {
        if (M.requested || ! navigator.requestMIDIAccess)
            return;
        M.requested = true;
        navigator.requestMIDIAccess ({ sysex: false }).then (function (access) {
            M.access = access;
            try { localStorage.setItem ("vial-midi-enabled", "1"); } catch (err) {}
            access.onstatechange = function() { M.refresh(); };
            M.refresh();
        }).catch (function (err) {
            console.warn ("Web MIDI unavailable", err);
        });
    };

    M.request = request;

    var wasEnabled = false;
    try { wasEnabled = localStorage.getItem ("vial-midi-enabled") === "1"; } catch (err) {}

    if (wasEnabled)
    {
        try {
            if (navigator.permissions && navigator.permissions.query)
                navigator.permissions.query ({ name: "midi", sysex: false }).then (function (s) {
                    if (s.state === "granted")
                        request();
                }).catch (function() {});
        } catch (err) {}
    }
});

EM_JS (char*, juce_webmidi_list, (int outputs), {
    var M = Module.juceMidi;
    var list = M ? (outputs ? M.outputs : M.inputs) : [];
    var TAB = String.fromCharCode (9), NL = String.fromCharCode (10);
    var clean = function (v) { return String (v).split (TAB).join (" ").split (NL).join (" "); };
    var s = list.map (function (d) { return clean (d.id) + TAB + clean (d.name); }).join (NL);
    var n = lengthBytesUTF8 (s) + 1;
    var p = _malloc (n);
    stringToUTF8 (s, p, n);
    return p;
});

EM_JS (void, juce_webmidi_openInput, (int handle, const char* id), {
    var M = Module.juceMidi;
    if (! M) return;
    M.openInputs[handle] = { id: UTF8ToString (id), port: null, active: false };
    M.attach (handle);
});

EM_JS (void, juce_webmidi_setInputActive, (int handle, int active), {
    var M = Module.juceMidi;
    if (! M || ! M.openInputs[handle]) return;
    M.openInputs[handle].active = active != 0;
    M.attach (handle);
});

EM_JS (void, juce_webmidi_closeInput, (int handle), {
    var M = Module.juceMidi;
    if (! M || ! M.openInputs[handle]) return;
    var entry = M.openInputs[handle];
    if (entry.port)
        entry.port.onmidimessage = null;
    delete M.openInputs[handle];
});

EM_JS (void, juce_webmidi_send, (const char* id, const unsigned char* data, int size), {
    var M = Module.juceMidi;
    if (! M || ! M.access) return;
    var target = UTF8ToString (id);
    var bytes = Array.prototype.slice.call (HEAPU8.subarray (data, data + size));
    M.access.outputs.forEach (function (p) {
        if (p.id == target)
        {
            try { p.send (bytes); } catch (err) {}
        }
    });
});

static Array<MidiDeviceInfo> getWebMidiDevices (bool outputs)
{
    if (! MessageManager::getInstance()->isThisTheMessageThread())
        return {};

    juce_webmidi_init();

    auto* raw = juce_webmidi_list (outputs ? 1 : 0);
    auto lines = StringArray::fromLines (String::fromUTF8 (raw));
    free (raw);

    Array<MidiDeviceInfo> devices;

    for (auto& line : lines)
    {
        if (line.isEmpty())
            continue;

        auto id = line.upToFirstOccurrenceOf ("\t", false, false);
        auto name = line.fromFirstOccurrenceOf ("\t", false, false);
        devices.add ({ name, id });
    }

    return devices;
}

class MidiInput::Pimpl
{
public:
    Pimpl (MidiInput& in, MidiInputCallback* cb, const String& id)
        : input (in), callback (cb), identifier (id), handle (nextHandle()++)
    {
        getRegistry()[handle] = this;
        juce_webmidi_openInput (handle, identifier.toRawUTF8());
    }

    ~Pimpl()
    {
        juce_webmidi_closeInput (handle);
        getRegistry().erase (handle);
    }

    void start()  { juce_webmidi_setInputActive (handle, 1); }
    void stop()   { juce_webmidi_setInputActive (handle, 0); }

    static void deliver (int handle, const uint8* data, int size)
    {
        auto it = getRegistry().find (handle);

        if (it == getRegistry().end() || it->second->callback == nullptr)
            return;

        auto* self = it->second;
        auto time = Time::getMillisecondCounterHiRes() * 0.001;
        int pos = 0;

        while (pos < size)
        {
            int consumed = 0;
            MidiMessage message (data + pos, size - pos, consumed, 0, time, false);

            if (consumed <= 0)
                break;

            self->callback->handleIncomingMidiMessage (&self->input, message);
            pos += consumed;
        }
    }

private:
    static std::map<int, Pimpl*>& getRegistry()
    {
        static std::map<int, Pimpl*> registry;
        return registry;
    }

    static int& nextHandle()
    {
        static int h = 1;
        return h;
    }

    MidiInput& input;
    MidiInputCallback* callback;
    String identifier;
    int handle;

    JUCE_DECLARE_NON_COPYABLE (Pimpl)
};

MidiInput::MidiInput (const String& deviceName, const String& deviceIdentifier)
    : deviceInfo (deviceName, deviceIdentifier)
{
}

MidiInput::~MidiInput()
{
    stop();
}

void MidiInput::start()
{
    if (internal != nullptr)
        internal->start();
}

void MidiInput::stop()
{
    if (internal != nullptr)
        internal->stop();
}

Array<MidiDeviceInfo> MidiInput::getAvailableDevices()
{
    return getWebMidiDevices (false);
}

MidiDeviceInfo MidiInput::getDefaultDevice()
{
    auto devices = getAvailableDevices();
    return devices.isEmpty() ? MidiDeviceInfo() : devices.getFirst();
}

std::unique_ptr<MidiInput> MidiInput::openDevice (const String& deviceIdentifier, MidiInputCallback* callback)
{
    if (deviceIdentifier.isEmpty())
        return {};

    String name = deviceIdentifier;

    for (auto& d : getAvailableDevices())
        if (d.identifier == deviceIdentifier)
            name = d.name;

    std::unique_ptr<MidiInput> midiInput (new MidiInput (name, deviceIdentifier));
    midiInput->internal = std::make_unique<Pimpl> (*midiInput, callback, deviceIdentifier);
    return midiInput;
}

std::unique_ptr<MidiInput> MidiInput::createNewDevice (const String&, MidiInputCallback*)
{
    return {};
}

StringArray MidiInput::getDevices()
{
    StringArray names;

    for (auto& d : getAvailableDevices())
        names.add (d.name);

    return names;
}

int MidiInput::getDefaultDeviceIndex()
{
    return 0;
}

std::unique_ptr<MidiInput> MidiInput::openDevice (int index, MidiInputCallback* callback)
{
    auto devices = getAvailableDevices();

    if (isPositiveAndBelow (index, devices.size()))
        return openDevice (devices[index].identifier, callback);

    return {};
}

class MidiOutput::Pimpl
{
public:
    explicit Pimpl (const String& id) : identifier (id) {}
    String identifier;
};

MidiOutput::~MidiOutput()
{
    stopBackgroundThread();
}

void MidiOutput::sendMessageNow (const MidiMessage& message)
{
    if (internal == nullptr)
        return;

    auto id = internal->identifier;
    MemoryBlock bytes (message.getRawData(), (size_t) message.getRawDataSize());

    auto send = [id, bytes]
    {
        juce_webmidi_send (id.toRawUTF8(), (const unsigned char*) bytes.getData(), (int) bytes.getSize());
    };

    if (MessageManager::getInstance()->isThisTheMessageThread())
        send();
    else
        MessageManager::callAsync (send);
}

Array<MidiDeviceInfo> MidiOutput::getAvailableDevices()
{
    return getWebMidiDevices (true);
}

MidiDeviceInfo MidiOutput::getDefaultDevice()
{
    auto devices = getAvailableDevices();
    return devices.isEmpty() ? MidiDeviceInfo() : devices.getFirst();
}

std::unique_ptr<MidiOutput> MidiOutput::openDevice (const String& deviceIdentifier)
{
    if (deviceIdentifier.isEmpty())
        return {};

    String name = deviceIdentifier;

    for (auto& d : getAvailableDevices())
        if (d.identifier == deviceIdentifier)
            name = d.name;

    std::unique_ptr<MidiOutput> midiOutput (new MidiOutput (name, deviceIdentifier));
    midiOutput->internal = std::make_unique<Pimpl> (deviceIdentifier);
    return midiOutput;
}

std::unique_ptr<MidiOutput> MidiOutput::createNewDevice (const String&)
{
    return {};
}

StringArray MidiOutput::getDevices()
{
    StringArray names;

    for (auto& d : getAvailableDevices())
        names.add (d.name);

    return names;
}

int MidiOutput::getDefaultDeviceIndex()
{
    return 0;
}

std::unique_ptr<MidiOutput> MidiOutput::openDevice (int index)
{
    auto devices = getAvailableDevices();

    if (isPositiveAndBelow (index, devices.size()))
        return openDevice (devices[index].identifier);

    return {};
}

}

extern "C" EMSCRIPTEN_KEEPALIVE void juce_webmidi_message (int handle, const unsigned char* data, int size)
{
    juce::MidiInput::Pimpl::deliver (handle, (const juce::uint8*) data, size);
}
