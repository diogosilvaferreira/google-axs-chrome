# Download native client from http://code.google.com/p/nativeclient and
# point this to the directory created by unextracting the tarball
# (called "build" by default).
NACL_SDK = <insert your path here>/nacl_sdk
NACL_BIN = $(NACL_SDK)/toolchain/linux_x86/bin

# NACL Tools
NACL_CC_32 = $(NACL_BIN)/nacl-gcc
NACL_CC_64 = $(NACL_BIN)/nacl64-gcc
NACL_CCC_32 = $(NACL_BIN)/nacl-g++
NACL_CCC_64 = $(NACL_BIN)/nacl64-g++
NACL_LD_32 = $(NACL_BIN)/nacl-ld
NACL_LD_64 = $(NACL_BIN)/nacl64-ld
NACL_OBJCOPY_32 = $(NACL_BIN)/nacl-objcopy
NACL_OBJCOPY_64 = $(NACL_BIN)/nacl64-objcopy
NACL_STRIP_32 = $(NACL_BIN)/nacl-strip
NACL_STRIP_64 = $(NACL_BIN)/nacl64-strip

# NACL Tool Flags
CFLAGS = \
	-Wall \
	-O2 \
	-pthread \
	-Ilibresample -Ipico
NACL_CFLAGS = $(CFLAGS) -DEMBED_FILES -D__linux

LDFLAGS = -lm
NACL_LDFLAGS = $(LDFLAGS) -lppapi -lppapi_cpp

NACL_OBJCOPY_OPTS_32 = "-I binary -B i386 -O elf32-nacl"
NACL_OBJCOPY_OPTS_64 = "-I binary -B i386 -O elf64-nacl"

# Object directories
OBJ_DIR_32 = objs_nacl_x86-32
OBJ_DIR_64 = objs_nacl_x86-64

C_SRCS = pico_embedded_files.c libresample/filterkit.c libresample/resample.c libresample/resamplesubs.c pico/picoacph.c pico/picoapi.c pico/picobase.c pico/picocep.c pico/picoctrl.c pico/picodata.c pico/picodbg.c pico/picoextapi.c pico/picofftsg.c pico/picokdbg.c pico/picokdt.c pico/picokfst.c pico/picoklex.c pico/picoknow.c pico/picokpdf.c pico/picokpr.c pico/picoktab.c pico/picoos.c pico/picopal.c pico/picopam.c pico/picopr.c pico/picorsrc.c pico/picosa.c pico/picosig.c pico/picosig2.c pico/picospho.c pico/picotok.c pico/picotrns.c pico/picowa.c
CC_SRCS = earcon_manager.cc log.cc threading.cc nacl_main.cc nacl_tts_plugin.cc load_pico_voices_static.cc pico_tts_engine.cc resampler.cc tts_engine.cc tts_service.cc
HEADERS = audio_output.h earcon_manager.h log.h base.h nacl_main.h nacl_tts_plugin.h pico_tts_engine.h resampler.h ringbuffer.h threading.h tts_engine.h tts_receiver.h tts_service.h libresample/libresample.h libresample/config.h libresample/filterkit.h libresample/resample_defs.h pico/picoacph.h pico/picoapi.h pico/picoapid.h pico/picobase.h pico/picocep.h pico/picoctrl.h pico/picodata.h pico/picodbg.h pico/picodefs.h pico/picodsp.h pico/picoextapi.h pico/picofftsg.h pico/picokdbg.h pico/picokdt.h pico/picokfst.h pico/picoklex.h pico/picoknow.h pico/picokpdf.h pico/picokpr.h pico/picoktab.h pico/picoos.h pico/picopal.h pico/picopam.h pico/picopltf.h pico/picopr.h pico/picorsrc.h pico/picosa.h pico/picosig.h pico/picosig2.h pico/picospho.h pico/picotok.h pico/picotrns.h pico/picowa.h
EMBEDDED = en-US_lh0_sg en-US_ta

#all: dirs tts_service_x86-32.nexe httpd.py

all: dirs tts_service_x86-64.nexe tts_service_x86-32.nexe httpd.py
	@echo ""
	@echo "Build done."
	@echo ""
	@echo "To run in web browser:"
	@echo ""
	@echo "  python httpd.py"
	@echo ""
	@echo "Then visit http://localhost:5103/tts_service_demo.html"

clean:
	rm -rf tts_service_x86-64 tts_service_x86-32.nexe httpd.py $(OBJ_DIR_32) $(OBJ_DIR_64)

dirs:
	-mkdir -p {$(OBJ_DIR_32),$(OBJ_DIR_64)}/{libresample,pico}

httpd.py:
	cat $(NACL_SDK)/examples/httpd.py | \
		sed "s/\['examples'\]/\['tts_service_nacl'\]/" \
		> httpd.py

EMBEDDED_SRCS = $(EMBEDDED:%=data/%.bin)

# Embedded objects for x86-32
NACL_EMBEDDED_OBJS_32 = $(EMBEDDED:%=$(OBJ_DIR_32)/%.o)
NACL_EMBEDDED_DATA_OBJS_32 = $(EMBEDDED:%=$(OBJ_DIR_32)/%_data.o)

$(NACL_EMBEDDED_OBJS_32): $(OBJ_DIR_32)/%.o: data/%.bin
	python ./filewrapper.py \
		--out_cc $(@:%.o=%.c) \
		--out_h $(OBJ_DIR_32)/$(subst -,_,$(@:$(OBJ_DIR_32)/%.o=%.h)) \
		--out_o $(@:%.o=%_data.o) \
		--ld $(NACL_LD_32) \
		--objcopy $(NACL_OBJCOPY_32) \
		--objcopy_opts $(NACL_OBJCOPY_OPTS_32) \
		$(subst -,_,$(@:$(OBJ_DIR_32)/%.o=%)) \
		$(@:$(OBJ_DIR_32)/%.o=data/%.bin)
	$(NACL_CC_32) -c $(NACL_CFLAGS) $(@:%.o=%.c) -o $@

# Embedded objects for x86-64
NACL_EMBEDDED_OBJS_64 = $(EMBEDDED:%=$(OBJ_DIR_64)/%.o)
NACL_EMBEDDED_DATA_OBJS_64 = $(EMBEDDED:%=$(OBJ_DIR_64)/%_data.o)

$(NACL_EMBEDDED_OBJS_64): $(OBJ_DIR_64)/%.o: data/%.bin
	python ./filewrapper.py \
		--out_cc $(@:%.o=%.c) \
		--out_h $(OBJ_DIR_64)/$(subst -,_,$(@:$(OBJ_DIR_64)/%.o=%.h)) \
		--out_o $(@:%.o=%_data.o) \
		--ld $(NACL_LD_64) \
		--objcopy $(NACL_OBJCOPY_64) \
		--objcopy_opts $(NACL_OBJCOPY_OPTS_64) \
		$(subst -,_,$(@:$(OBJ_DIR_64)/%.o=%)) \
		$(@:$(OBJ_DIR_64)/%.o=data/%.bin)
	$(NACL_CC_64) -c $(NACL_CFLAGS) $(@:%.o=%.c) -o $@

# Compile rules for x86-32
NACL_C_OBJS_32 = $(C_SRCS:%.c=$(OBJ_DIR_32)/%.o)
NACL_CC_OBJS_32 = $(CC_SRCS:%.cc=$(OBJ_DIR_32)/%.o)
NACL_OBJS_32 = $(NACL_C_OBJS_32) $(NACL_CC_OBJS_32)

$(NACL_C_OBJS_32): $(OBJ_DIR_32)/%.o: %.c $(NACL_EMBEDDED_OBJS_32) $(HEADERS)
	$(NACL_CC_32) -c $(NACL_CFLAGS) -I$(OBJ_DIR_32) $< -o $@

$(NACL_CC_OBJS_32): $(OBJ_DIR_32)/%.o: %.cc $(NACL_EMBEDDED_OBJS_32) $(HEADERS)
	$(NACL_CCC_32) -c $(NACL_CFLAGS) -I$(OBJ_DIR_32) $< -o $@

# Compile rules for x86-64
NACL_C_OBJS_64 = $(C_SRCS:%.c=$(OBJ_DIR_64)/%.o)
NACL_CC_OBJS_64 = $(CC_SRCS:%.cc=$(OBJ_DIR_64)/%.o)
NACL_OBJS_64 = $(NACL_C_OBJS_64) $(NACL_CC_OBJS_64)

$(NACL_C_OBJS_64): $(OBJ_DIR_64)/%.o: %.c $(NACL_EMBEDDED_OBJS_64) $(HEADERS)
	$(NACL_CC_64) -c $(NACL_CFLAGS) -I$(OBJ_DIR_64) $< -o $@

$(NACL_CC_OBJS_64): $(OBJ_DIR_64)/%.o: %.cc $(NACL_EMBEDDED_OBJS_64) $(HEADERS)
	$(NACL_CCC_64) -c $(NACL_CFLAGS) -I$(OBJ_DIR_64) $< -o $@

# Linking rules
tts_service_x86-64.nexe: $(NACL_OBJS_64) $(NACL_EMBEDDED_OBJS_64)
	$(NACL_CCC_64) \
	$(CFLAGS) \
	-o tts_service_x86-64.nexe \
	$(NACL_OBJS_64) $(NACL_EMBEDDED_OBJS_64) $(NACL_EMBEDDED_DATA_OBJS_64) \
	$(NACL_LDFLAGS)
	$(NACL_STRIP_64) tts_service_x86-64.nexe

tts_service_x86-32.nexe: $(NACL_OBJS_32) $(NACL_EMBEDDED_OBJS_32)
	$(NACL_CCC_32) \
	$(CFLAGS) \
	-o tts_service_x86-32.nexe \
	$(NACL_OBJS_32) $(NACL_EMBEDDED_OBJS_32) $(NACL_EMBEDDED_DATA_OBJS_32) \
	$(NACL_LDFLAGS)
	$(NACL_STRIP_32) tts_service_x86-32.nexe

