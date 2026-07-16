/* Public domain. */

#include <sys/types.h>
#ifdef HAVE_FLOCK
#include <sys/file.h>
#endif
#include <fcntl.h>
#include <unistd.h>
#include "lock.h"

#ifdef HAVE_FLOCK
int lock_ex(int fd) { return flock(fd,LOCK_EX); }
#else
int lock_ex(int fd) { return lockf(fd,1,0); }
#endif
