/* Public domain. */

#include <fcntl.h>
#include <sys/types.h>
#include "open.h"

int open_write(const char *fn)
{ return open(fn,O_WRONLY | O_NDELAY); }
