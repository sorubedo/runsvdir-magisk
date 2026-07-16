/* Public domain. */

#include <fcntl.h>
#include <sys/types.h>
#include "open.h"

int open_trunc(const char *fn)
{ return open(fn,O_WRONLY | O_NDELAY | O_TRUNC | O_CREAT,0644); }
