/* Bionic (Android) platform configuration for runit */

#ifndef BIONIC_CONFIG_H
#define BIONIC_CONFIG_H

/* Bionic has poll() */
#define HAVE_POLL 1

/* Bionic has sys/select.h */
#define HAVE_SYS_SELECT_H 1

/* Bionic has dirent.h */
#define HAVE_DIRENT_H 1

/* Bionic has stdint.h and inttypes.h */
#define HAVE_STDINT_H 1
#define HAVE_INTTYPES_H 1

/* Bionic has POSIX sigaction */
#define HAVE_SIGACTION 1

/* Bionic has POSIX sigprocmask */
#define HAVE_SIGPROCMASK 1

/* Bionic has POSIX waitpid */
#define HAVE_WAITPID 1

/* Bionic has POSIX mkfifo */
#define HAVE_MKFIFO 1

/*
 * Features NOT available on Bionic (left undefined):
 *   HAVE_FLOCK          -> lockf() fallback used automatically
 *   HAVE_SHORT_SETGROUPS -> POSIX standard setgroups() used
 *   HAVE_UTMP / HAVE_UTMPX -> utmpset.c not compiled
 *   HAVE_REBOOT_*ARG    -> runit.c/runit-init.c not compiled
 */

#endif /* BIONIC_CONFIG_H */
