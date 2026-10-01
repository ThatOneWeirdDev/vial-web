namespace juce
{

namespace EmscriptenEventLoop
{
    void addFrameCallback (void* owner, std::function<void (double)> callback);
    void removeFrameCallback (void* owner);
    void scheduleDispatch();
    bool isDispatching();
}

}
