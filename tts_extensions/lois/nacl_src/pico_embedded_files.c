// Copyright 2009 and beyond, Google Inc.
// All Rights Reserved.
//
// Author: dmazzoni@google.com (Dominic Mazzoni)
//
// Embedded-file implementation of Pico's file operations.

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <sys/types.h>

#include "picodefs.h"
#include "picopal.h"

#include "en_US_ta.h"
#include "en_US_lh0_sg.h"


struct efileinfo {
  const struct FileToc *toc;
  size_t pos;
};


const struct FileToc* get_embedded_file(picopal_char filename[]) {
  printf("get_embedded_file %s\n", (const char *)filename);

  if (0 == strcmp((const char *)filename, "en-US_ta.bin")) {
    return en_US_ta_create();
  } else if (0 == strcmp((const char *)filename, "en-US_lh0_sg.bin")) {
    return en_US_lh0_sg_create();
  } else {
    return NULL;
  }
}


picopal_File picopal_fopen (picopal_char filename[], picopal_access_mode mode)
{
  printf("picopal_fopen %s\n", (const char *)filename);
  if (mode == PICOPAL_TEXT_READ || mode == PICOPAL_BINARY_READ) {
    const struct FileToc *toc = get_embedded_file(filename);
    struct efileinfo *fp;
    if (!toc) {
      return NULL;
    }
    fp = (struct efileinfo *)malloc(sizeof(struct efileinfo));
    fp->toc = toc;
    fp->pos = 0;
    return (picopal_File)fp;
  }
  return NULL;
}


picopal_File picopal_get_fnil (void)
{
  return (picopal_File) NULL;
}


picopal_int8 picopal_is_fnil (picopal_File f)
{
  return (NULL == f);
}

pico_status_t picopal_fflush (picopal_File f)
{
  return PICO_OK;
}


pico_status_t picopal_fclose (picopal_File f)
{
  free((void *)f);
  return PICO_OK;
}


picopal_uint32 picopal_flength (picopal_File stream)
{
  struct efileinfo *fp = (struct efileinfo *)stream;
  return (picopal_uint32)fp->toc->size;
}


picopal_uint8 picopal_feof (picopal_File stream)
{
  struct efileinfo *fp = (struct efileinfo *)stream;
  if (fp->pos == fp->toc->size)
    return 1;
  else
    return 0;
}

pico_status_t picopal_fseek (picopal_File f, picopal_uint32 offset,
                             picopal_int8 seekmode)
{
  struct efileinfo *fp = (struct efileinfo *)f;
  if (seekmode == SEEK_SET) {
    fp->pos = offset;
  } else if (seekmode == SEEK_CUR) {
    fp->pos += offset;
  } else if (seekmode == SEEK_END) {
    fp->pos = fp->toc->size + offset;
  }

  if (fp->pos < 0) {
    fp->pos = 0;
  } else if (fp->pos > fp->toc->size) {
    fp->pos = fp->toc->size;
  }

  return PICO_OK;
}

pico_status_t picopal_fget_char (picopal_File f, picopal_char * ch)
{
  struct efileinfo *fp = (struct efileinfo *)f;
  if (fp->pos < fp->toc->size) {
    *ch = fp->toc->data[fp->pos];
    fp->pos++;
    return PICO_OK;
  } else {
    return PICO_EOF;
  }
}

picopal_objsize_t picopal_fread_bytes (picopal_File f,
                                       void * ptr,
                                       picopal_objsize_t objsize,
                                       picopal_uint32 nobj)
{
  struct efileinfo *fp = (struct efileinfo *)f;
  int bytes = objsize * nobj;

  if (bytes + fp->pos > fp->toc->size) {
    bytes = fp->toc->size - fp->pos;
    // Make sure it's a multiple of objsize
    bytes = (bytes / objsize) * objsize;
  }

  memcpy(ptr, &fp->toc->data[fp->pos], bytes);
  fp->pos += bytes;

  return bytes / objsize;
}

picopal_objsize_t picopal_fwrite_bytes (picopal_File f,
                                        void * ptr,
                                        picopal_objsize_t objsize,
                                        picopal_uint32 nobj) {
  return -1;
}

