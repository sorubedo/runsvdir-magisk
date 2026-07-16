# Build all targets with Bionic feature defines
add_compile_definitions(
    HAVE_POLL
    HAVE_SYS_SELECT_H
    HAVE_DIRENT_H
    HAVE_STDINT_H
    HAVE_INTTYPES_H
    HAVE_SIGACTION
    HAVE_SIGPROCMASK
    HAVE_WAITPID
    HAVE_MKFIFO
)

add_compile_definitions(VERSION="2.1.2")

# ---- runit support library ----
set(RUNIT_LIB_SOURCES
    alloc.c alloc_re.c
    buffer.c buffer_0.c buffer_1.c buffer_2.c
    buffer_get.c buffer_put.c buffer_read.c buffer_write.c
    byte_chr.c byte_copy.c byte_cr.c byte_diff.c byte_rchr.c
    coe.c
    env.c
    error.c error_str.c
    fd_copy.c fd_move.c
    fifo.c
    fmt_ptime.c fmt_uint.c fmt_uint0.c fmt_ulong.c
    iopause.c
    lock_ex.c lock_exnb.c
    ndelay_off.c ndelay_on.c
    open_append.c open_read.c open_trunc.c open_write.c openreadclose.c
    pathexec_env.c pathexec_run.c
    pmatch.c
    prot.c
    readclose.c
    scan_ulong.c
    seek_set.c
    sgetopt.c
    sig.c sig_block.c sig_catch.c sig_pause.c
    str_chr.c str_diff.c str_len.c str_start.c
    stralloc_cat.c stralloc_catb.c stralloc_cats.c
    stralloc_eady.c stralloc_opyb.c stralloc_opys.c stralloc_pend.c
    strerr_die.c strerr_sys.c
    subgetopt.c
    taia_add.c taia_approx.c taia_frac.c taia_less.c
    taia_now.c taia_pack.c taia_sub.c taia_uint.c
    tai_now.c tai_pack.c tai_sub.c tai_unpack.c
    uidgid.c
    wait_nohang.c wait_pid.c
)

add_library(runit_lib STATIC ${RUNIT_LIB_SOURCES})
target_include_directories(runit_lib INTERFACE "${CMAKE_CURRENT_SOURCE_DIR}")
target_compile_options(runit_lib PRIVATE -Wall -Os)

# ---- Executables ----
set(BINARIES
    runsvdir   runsv   sv   svlogd   chpst   runsvchdir
)

foreach(bin ${BINARIES})
    add_executable(${bin} "${bin}.c")
    target_link_libraries(${bin} PRIVATE runit_lib)
    target_compile_options(${bin} PRIVATE -Wall -Os -fPIE)
    target_link_options(${bin} PRIVATE -static -Wl,-z,now)
endforeach()

# ---- Install ----
install(TARGETS ${BINARIES}
    RUNTIME DESTINATION bin
    LIBRARY DESTINATION lib
)
