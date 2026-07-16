/* Public domain. */

#include <signal.h>

#include "sig.h"

#ifndef SIGPWR
#define SIGPWR SIGUSR2 /* as in sysvinit */
#endif

int sig_alarm = SIGALRM;
int sig_child = SIGCHLD;
int sig_cont = SIGCONT;
int sig_hangup = SIGHUP;
int sig_int = SIGINT;
int sig_pipe = SIGPIPE;
int sig_pwr = SIGPWR;
int sig_term = SIGTERM;

void (*sig_defaulthandler)() = SIG_DFL;
void (*sig_ignorehandler)() = SIG_IGN;
