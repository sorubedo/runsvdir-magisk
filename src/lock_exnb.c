/* Public domain. */

#include <sys/types.h>
#ifdef HAVE_FLOCK
#include <sys/file.h>
#endif
#include <fcntl.h>
#include <unistd.h>
#include "lock.h"

#ifdef HAVE_FLOCK
int lock_exnb(int fd) { return flock(fd,LOCK_EX | LOCK_NB); }
#else
int lock_exnb(int fd) { return lockf(fd,2,0); }
#endif
