#!/usr/bin/python2.4
#
# Copyright 2009 Google Inc. All Rights Reserved.

"""Utility that encapsulates the given files as binary blobs in a .o file.

The following files are generated:
    <name>.h       The header file describing the data.
    <name>.cc      Table of contents initialization.
    <name>_data.o  The raw data and associated symbols.

The original filewrapper.py was written by Glenn Trewitt.
Made portable and self-contained for the Native Client version
of the TTS Service by Dominic Mazzoni.
"""

__author__ = "dmazzoni@google.com (Dominic Mazzoni)"

import os
import re
import sys


opt_list = [
    ("out_h", "", "Filename for the .h file"),
    ("out_o", "", "Filename for the .o file"),
    ("out_cc", "", "Filename for the .cc file"),
    ("include_path", "", "Path to use when writing #include"),
    ("objcopy", "objcopy", "Path to objcopy utility"),
    ("objcopy_opts", "-I binary -B i386 -O elf32-i386",
     "objcopy options to set the .o to be \"normal\" for this platform"),
    ("ld", "ld", "Path to ld utility"),
    ("ldopts", "", "ld options")]

opts = dict(o[:2] for o in opt_list)

#  Used to translate file names to symbol names, which have all
#  non-alphanumeric characters replaced with '_'
symbol_filter = re.compile("[^a-zA-Z0-9_]")

toc_comment = ""


def WriteHeader(filename, base):
  """Write the table of contents .h file.

  There are two #ifndef wrappers, one for the common structures,
  and one for this specific set of wrapped files.

  Args:
    filename : The file to write to.
    base : The base name for everything.
  """
  print os.getcwd()
  file_toc = """
    #ifndef FILETOC_
    #define FILETOC_
    #include <sys/types.h>

    /* Imported by filewrapper.py */
    struct FileToc {
      const char* name;
      const char* data;
      size_t size;
    };

    #endif  // FILETOC_
  """
  hdr = open(filename, "w")
  hdr.write("""\
%(comment)s\
//  Output: %(filename)s

%(file_toc)s

#ifndef __STRUCT_FILE_TOC_%(base)s_
#define __STRUCT_FILE_TOC_%(base)s_

extern const struct FileToc* %(base)s_create();

#endif // __STRUCT_FILE_TOC_%(base)s_
""" % {"comment": toc_comment, "base": base,
       "filename": filename, "file_toc": file_toc})
  hdr.close()


def WriteCpp(filename, base, externs, initializers):
  """Write the .cc file.

  Args:
    filename     : The file to write to.
    base         : The base name for everything.
    externs      : The list of extern declarations.
    initializers : The list of information about each encapsulated file.
  """
  toc = open(filename, "w")
  toc.write("""\
%(comment)s\
//  Output: %(filename)s

#include "%(hdr)s.h"

""" % {"filename": filename, "comment": toc_comment,
       "hdr": os.path.join(opts["include_path"], base)})

  toc.write("\n".join(externs))
  toc.write("""

static const struct FileToc toc[%(size)d] = {
""" % {"size": len(initializers)+1})

  for (filedata, sym, size) in initializers:
    if size != 0:
      toc.write("  { \"%s\", &%s_start, %d },\n" %
                (filedata, sym, size))
    else:
      toc.write("  { \"%s\", \"\", 0 },\n" % filedata)
  toc.write("""\
  { (const char*) 0, (const char*) 0, 0 }
};

const struct FileToc* %(base)s_create() {
  return toc;
}
""" % {"base": base})

  toc.close()


def EncapsulateFiles(infiles, result):
  """Convert each file to a .o and link them together into a single .o.

  Args:
    infiles : a list of files to be encapsulated.
    result : the name of the object file to generate.

  For each input file to be embedded, we run objcopy to create a .o
  object file.  The object file contains the contents of the input
  file, along with three symbols that are automatically defined by
  objcopy:
    _binary_$NAME_start
    _binary_$NAME_end
    _binary_$NAME_size
  The _start symbol and the measured size of the file are used to
  build the table of contents.

  Returns a tuple of lists:
     objfiles: object file names
     initializers: (file, symbol, size)
     externs: list of "extern" declarations.
  Each list contains one item for each input file.
  """

  # Create a temporary directory for the intermediate .o files.  Note
  # that objcopy chooses the symbol names based on the output filename,
  # including any path components.  (See the computation of "symbol"
  # below.)  We want the symbol names to be guaranteed unique within an
  # executable, but we also want the build to be deterministic across
  # runs, and insensitive to the absolute locations of source or output
  # files.  So we name the tempdir based on the (presumed relative)
  # output filename.
  tmpdir = "%s.tmpdir.filewrapper" % result
  if not os.path.isdir(tmpdir):
    try:
      if os.path.exists(tmpdir):
        os.unlink(tmpdir)
      os.mkdir(tmpdir)
    except OSError, e:
      print >>sys.stderr, (
          "filewrapper: failed to create output directory '%s': %s." %
          (tmpdir, str(e)))
      sys.exit(1)

  try:
    seq = 0
    objfiles = []
    externs = []
    initializers = []
    prefixes = []
    # ensure that the prefix ends, but does not start, with a slash.
    # This allows both "//third_party/some/path" and "subdir/" to work.
    for filename in infiles:
      filecopy = os.path.join(tmpdir, "s%d" % seq)
      symbol = symbol_filter.sub("_", "_binary_" + filecopy)
      obj = os.path.join(tmpdir, "f%d.o" % seq)
      size = os.stat(filename).st_size

      # NOTE(johnfish): objcopy >2.13 disallows empty files
      if size != 0:
        # copy the input file to the temp directory and append a null.
        f_in = open(filename, "rb")
        f_out = open(filecopy, "wb")
        while 1:
          data = f_in.read(4096)
          if not data:
            break
          f_out.write(data)
        f_out.write("\0")
        f_in.close()
        f_out.close()

        if (0 != os.system("%s %s %s %s" %
                           (opts["objcopy"],
                            opts["objcopy_opts"], filecopy, obj))):
          print >>sys.stderr, "filewrapper: objcopy failed"
          sys.exit(1)
        objfiles.append(obj)
      #  Strip off the prefix for TOC names.
      else:
        for prefix in prefixes:
          if file.startswith(prefix):
            filename = filename[len(prefix):]
      initializers.append((filename, symbol, size))
      externs.append("extern const char %s_start;" % symbol)
      seq += 1

    # Link all of the wrapped objects together.
    print "%s %s -r -o %s %s" % (
        opts["ld"], opts["ldopts"],
        result, " ".join(objfiles))

    if (0 != os.system("%s %s -r -o %s %s" %
                       (opts["ld"], opts["ldopts"],
                        result, " ".join(objfiles)))):
      print >>sys.stderr, "filewrapper: ld failed"
      sys.exit(1)

  finally:
    pass

  return (objfiles, initializers, externs)


def Usage():
  print "Usage: %s [options] name files..." % sys.argv[0]
  for (name, default_value, help_str) in opt_list:
    print "  --%s=\"%s\": %s" % (name, default_value, help_str)


def main():
  # Get command-line arguments
  argv = sys.argv[:1]
  lastkey = None
  for arg in sys.argv[1:]:
    if lastkey:
      opts[lastkey] = arg
      lastkey = None
      continue

    m = re.match("--?([a-z_]+)=(.*)", arg)
    if m:
      print "Match %s" % arg
      (key, value) = (m.group(1), m.group(2))
      if key == "help" or key not in opts:
        Usage()
        sys.exit()
      else:
        opts[key] = value
    else:
      m = re.match("--?([a-z_]+)", arg)
      if m:
        lastkey = m.group(1)
        continue
      print "Append %s" % arg
      argv.append(arg)

  if len(argv) < 3:
    Usage()
    sys.exit()

  #  We generate everything in the temp directory, then move stuff
  #  to the final locations at the end.

  #  The base name for the files, functions and data structures.
  base = argv[1]

  #  The files to encapsulate.
  infiles = argv[2:]

  #  Compute the final destinations for the files.
  if not opts["out_h"]:
    hdr_name = base + ".h"
  else:
    hdr_name = opts["out_h"]
  if not opts["out_o"]:
    obj_name = base + "_data.o"
  else:
    obj_name = opts["out_o"]
  if not opts["out_cc"]:
    src_name = base + ".cc"
  else:
    src_name = opts["out_cc"]

  print "base: ", base
  print "infiles: ", str(infiles)
  print "opts: ", str(opts)

  (unused_objfiles, initializers, externs) = EncapsulateFiles(infiles, obj_name)

  global toc_comment
  toc_comment = "//  Automatically generated by filewrapper\n"
  toc_comment += "//    %s\n" % base

  WriteHeader(hdr_name, base)

  WriteCpp(src_name, base, externs, initializers)

if __name__ == "__main__":
  main()
