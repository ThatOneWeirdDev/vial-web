namespace juce
{

void MACAddress::findAllAddresses (Array<MACAddress>&)
{
}

bool JUCE_CALLTYPE Process::openEmailWithAttachments (const String&, const String&, const String&, const StringArray&)
{
    return false;
}

class WebInputStream::Pimpl
{
public:
    Pimpl (WebInputStream&, const URL&, bool) {}

    void withExtraHeaders (const String& extra)               { headers << extra; }
    void withCustomRequestCommand (const String&)             {}
    void withConnectionTimeout (int)                          {}
    void withNumRedirectsToFollow (int)                       {}
    int getStatusCode() const                                 { return 0; }
    StringPairArray getRequestHeaders() const                 { return WebInputStream::parseHttpHeaders (headers); }
    StringPairArray getResponseHeaders() const                { return {}; }
    bool connect (WebInputStream::Listener*)                  { return false; }
    void cancel()                                             {}
    bool isError() const                                      { return true; }
    bool isExhausted()                                        { return true; }
    int64 getPosition()                                       { return 0; }
    int64 getTotalLength()                                    { return 0; }
    int read (void*, int)                                     { return 0; }
    bool setPosition (int64)                                  { return false; }

private:
    String headers;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (Pimpl)
};

std::unique_ptr<URL::DownloadTask> URL::downloadToFile (const File& targetLocation, String extraHeaders, DownloadTask::Listener* listener, bool shouldUsePost)
{
    return URL::DownloadTask::createFallbackDownloader (*this, targetLocation, extraHeaders, listener, shouldUsePost);
}

}
