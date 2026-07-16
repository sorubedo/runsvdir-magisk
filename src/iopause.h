/* Public domain. */

#ifndef IOPAUSE_H
#define IOPAUSE_H

#ifdef HAVE_POLL
# define IOPAUSE_POLL

# include <sys/types.h>
# include <poll.h>

typedef struct pollfd iopause_fd;

# define IOPAUSE_READ POLLIN
# define IOPAUSE_WRITE POLLOUT

#else /* !HAVE_POLL */

typedef struct {
  int fd;
  short events;
  short revents;
} iopause_fd;

# define IOPAUSE_READ 1
# define IOPAUSE_WRITE 4

#endif /* !HAVE_POLL */

#include "taia.h"

extern void iopause(iopause_fd *,unsigned int,struct taia *,struct taia *);

#endif /* IOPAUSE_H */
