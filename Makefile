EMXX ?= em++
VITAL := vital
OUT ?= docs
CONFIG ?= Release
OBJDIR := build/obj-$(CONFIG)

JUCE_CODE := $(VITAL)/standalone/JuceLibraryCode
JUCE_MODULES := $(VITAL)/third_party/JUCE/modules

DEFINES := -DNDEBUG=1 -DNO_AUTH=1 -DOPENGL_ES=1 -DJUCE_OPENGL_ES=1 \
	-DJUCE_ALSA=0 -DJUCE_JACK=0 -DJUCE_WASAPI=0 -DJUCE_DIRECTSOUND=0 \
	-DJUCE_USE_CURL=0 -DJUCE_WEB_BROWSER=0 -DJUCE_DSP_USE_SHARED_FFTW=0 \
	-DJUCE_USE_XINERAMA=0 -DJUCE_USE_XSHM=0 -DJUCE_USE_XRENDER=0 -DJUCE_USE_XCURSOR=0 \
	-DJUCE_MODAL_LOOPS_PERMITTED=0 -DJUCE_CHECK_MEMORY_LEAKS=0 \
	-DJUCE_APP_VERSION=1.0.6 -DJUCE_APP_VERSION_HEX=0x10006 \
	-DJucePlugin_Build_VST=0 -DJucePlugin_Build_VST3=0 -DJucePlugin_Build_AU=0 \
	-DJucePlugin_Build_AUv3=0 -DJucePlugin_Build_RTAS=0 -DJucePlugin_Build_AAX=0 \
	-DJucePlugin_Build_Standalone=0 -DJucePlugin_Build_Unity=0 \
	-DBUILD_DATE="2021 01 01 00 00"

INCLUDES := -I$(JUCE_CODE) -I$(JUCE_MODULES) \
	-I$(VITAL)/src/common -I$(VITAL)/src/common/wavetable \
	-I$(VITAL)/src/interface/editor_components -I$(VITAL)/src/interface/editor_sections \
	-I$(VITAL)/src/interface/look_and_feel -I$(VITAL)/src/interface/wavetable \
	-I$(VITAL)/src/interface/wavetable/editors -I$(VITAL)/src/interface/wavetable/overlays \
	-I$(VITAL)/src/standalone -I$(VITAL)/src/synthesis/synth_engine \
	-I$(VITAL)/src/synthesis/effects -I$(VITAL)/src/synthesis/filters \
	-I$(VITAL)/src/synthesis/framework -I$(VITAL)/src/synthesis/lookups \
	-I$(VITAL)/src/synthesis/modulators -I$(VITAL)/src/synthesis/modules \
	-I$(VITAL)/src/synthesis/producers -I$(VITAL)/src/synthesis/utilities \
	-I$(VITAL)/third_party

ifeq ($(CONFIG),Debug)
OPT := -O1 -g2
LINKOPT := -O1 -g2 -sASSERTIONS=1
else
OPT := -O3
LINKOPT := -O3
endif

CXXFLAGS := $(OPT) -std=c++17 -pthread -msimd128 -msse2 -ffast-math -fno-strict-aliasing -fno-delete-null-pointer-checks \
	-sUSE_FREETYPE=1 -Wno-deprecated-declarations -Wno-unused-command-line-argument -Wno-nan-infinity-disabled \
	$(DEFINES) $(INCLUDES)

LDFLAGS := $(LINKOPT) -pthread -msimd128 -sUSE_FREETYPE=1 \
	-sUSE_WEBGL2=1 -sMIN_WEBGL_VERSION=2 -sMAX_WEBGL_VERSION=2 -sFULL_ES3=1 \
	-sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=268435456 -sMAXIMUM_MEMORY=2147483648 \
	-sSTACK_SIZE=4194304 -sDEFAULT_PTHREAD_STACK_SIZE=2097152 -sPTHREAD_POOL_SIZE=12 \
	-sENVIRONMENT=web,worker -sEXIT_RUNTIME=0 -sOFFSCREEN_FRAMEBUFFER=0 \
	-sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8,lengthBytesUTF8,FS,IDBFS,addRunDependency,removeRunDependency \
	-sEXPORTED_FUNCTIONS=_main,_malloc,_free \
	-sMODULARIZE=1 -sEXPORT_NAME=createVialModule \
	-lidbfs.js -lGL

JUCE_SOURCES := $(addprefix $(JUCE_CODE)/,include_juce_core.cpp include_juce_events.cpp \
	include_juce_data_structures.cpp include_juce_graphics.cpp include_juce_gui_basics.cpp \
	include_juce_gui_extra.cpp include_juce_audio_basics.cpp include_juce_audio_devices.cpp \
	include_juce_audio_formats.cpp include_juce_audio_processors.cpp include_juce_audio_utils.cpp \
	include_juce_dsp.cpp include_juce_opengl.cpp BinaryData.cpp)

VITAL_SOURCES := $(addprefix $(VITAL)/src/unity_build/,common.cpp synthesis.cpp \
	interface_editor_components.cpp interface_editor_sections.cpp interface_editor_sections2.cpp \
	interface_look_and_feel.cpp interface_wavetable.cpp standalone.cpp)

SOURCES := $(JUCE_SOURCES) $(VITAL_SOURCES)
OBJECTS := $(addprefix $(OBJDIR)/,$(notdir $(SOURCES:.cpp=.o)))

vpath %.cpp $(JUCE_CODE) $(VITAL)/src/unity_build

.PHONY: all clean site

all: site

$(OBJDIR):
	mkdir -p $@

$(OBJDIR)/%.o: %.cpp | $(OBJDIR)
	$(EMXX) $(CXXFLAGS) -MMD -MP -c $< -o $@

$(OUT)/vial.js: $(OBJECTS)
	mkdir -p $(OUT)
	$(EMXX) $(OBJECTS) $(LDFLAGS) -o $@

site: $(OUT)/vial.js
	cp web/index.html web/coi-serviceworker.js web/vial_shell.js web/icon.png web/icon-180.png web/icon-192.png web/icon-512.png web/manifest.webmanifest $(OUT)/
	touch $(OUT)/.nojekyll

clean:
	rm -rf build

-include $(OBJECTS:.o=.d)
