/// Seccomp profile generation for container security hardening
///
/// This module provides default seccomp profiles to restrict syscalls available
/// to malware samples running in the sandbox, reducing attack surface.

use serde_json::{json, Value};

/// List of allowed syscalls for basic process operations
fn allowed_syscalls() -> Vec<&'static str> {
    vec![
        "accept", "accept4", "access", "arch_prctl", "bind", "brk",
        "capget", "capset", "chdir", "chmod", "chown", "clock_getres",
        "clock_gettime", "clock_nanosleep", "clone", "close", "connect",
        "copy_file_range", "dup", "dup2", "dup3", "epoll_create", "epoll_create1",
        "epoll_ctl", "epoll_ctl_old", "epoll_pwait", "epoll_wait", "epoll_wait_old",
        "eventfd", "eventfd2", "execve", "execveat", "exit", "exit_group",
        "faccessat", "faccessat2", "fadvise64", "fallocate", "fanotify_mark",
        "fchdir", "fchmod", "fchmodat", "fchown", "fchownat", "fcntl",
        "fdatasync", "fgetxattr", "flistxattr", "flock", "fork", "fremovexattr",
        "fsetxattr", "fstat", "fstatat64", "fstatfs", "fsync", "ftruncate",
        "futex", "futimesat", "getcwd", "getdents", "getdents64", "getegid",
        "geteuid", "getgid", "getgroups", "getitimer", "getpeername", "getpgid",
        "getpgrp", "getpid", "getppid", "getpriority", "getrandom", "getresgid",
        "getresuid", "getrlimit", "get_robust_list", "getrusage", "getsid",
        "getsockname", "getsockopt", "get_thread_area", "gettid", "gettimeofday",
        "getuid", "getxattr", "inotify_add_watch", "inotify_init", "inotify_init1",
        "inotify_rm_watch", "io_cancel", "ioctl", "io_destroy", "io_getevents",
        "ioprio_get", "ioprio_set", "io_setup", "io_submit", "ipc", "kill",
        "lchown", "lgetxattr", "link", "linkat", "listen", "listxattr",
        "llistxattr", "lremovexattr", "lseek", "lsetxattr", "lstat", "madvise",
        "memfd_create", "mincore", "mkdir", "mkdirat", "mknod", "mknodat",
        "mlock", "mlock2", "mlockall", "mmap", "mmap2", "mprotect", "mq_getsetattr",
        "mq_notify", "mq_open", "mq_timedreceive", "mq_timedsend", "mq_unlink",
        "mremap", "msgctl", "msgget", "msgrcv", "msgsnd", "msync", "munlock",
        "munlockall", "munmap", "nanosleep", "newfstatat", "open", "openat",
        "pause", "pipe", "pipe2", "poll", "ppoll", "prctl", "pread64",
        "preadv", "preadv2", "prlimit64", "pselect6", "pwrite64", "pwritev",
        "pwritev2", "read", "readahead", "readlink", "readlinkat", "readv",
        "recv", "recvfrom", "recvmmsg", "recvmsg", "remap_file_pages", "removexattr",
        "rename", "renameat", "renameat2", "restart_syscall", "rmdir", "rt_sigaction",
        "rt_sigpending", "rt_sigprocmask", "rt_sigqueueinfo", "rt_sigreturn",
        "rt_sigsuspend", "rt_sigtimedwait", "rt_tgsigqueueinfo", "sched_getaffinity",
        "sched_getattr", "sched_getparam", "sched_get_priority_max", "sched_get_priority_min",
        "sched_getscheduler", "sched_rr_get_interval", "sched_setaffinity", "sched_setattr",
        "sched_setparam", "sched_setscheduler", "sched_yield", "seccomp", "select",
        "semctl", "semget", "semop", "semtimedop", "send", "sendfile", "sendfile64",
        "sendmmsg", "sendmsg", "sendto", "setfsgid", "setfsuid", "setgid", "setgroups",
        "setitimer", "setpgid", "setpriority", "setregid", "setresgid", "setresuid",
        "setreuid", "setrlimit", "set_robust_list", "setsid", "setsockopt",
        "set_thread_area", "set_tid_address", "setuid", "setxattr", "shmat",
        "shmctl", "shmdt", "shmget", "shutdown", "sigaltstack", "signalfd",
        "signalfd4", "sigreturn", "socket", "socketcall", "socketpair", "splice",
        "stat", "statfs", "statx", "symlink", "symlinkat", "sync", "sync_file_range",
        "syncfs", "sysinfo", "tee", "tgkill", "time", "timer_create", "timer_delete",
        "timerfd_create", "timerfd_gettime", "timerfd_settime", "timer_getoverrun",
        "timer_gettime", "timer_settime", "times", "tkill", "truncate", "umask",
        "uname", "unlink", "unlinkat", "utime", "utimensat", "utimes", "vfork",
        "vmsplice", "wait4", "waitid", "waitpid", "write", "writev"
    ]
}

/// List of blocked syscalls that could enable container escape
fn blocked_syscalls() -> Vec<&'static str> {
    vec![
        "acct", "add_key", "bpf", "clock_adjtime", "clock_settime",
        "create_module", "delete_module", "finit_module", "get_kernel_syms",
        "get_mempolicy", "init_module", "ioperm", "iopl", "kcmp",
        "kexec_file_load", "kexec_load", "keyctl", "lookup_dcookie",
        "mbind", "mount", "move_pages", "name_to_handle_at", "nfsservctl",
        "open_by_handle_at", "perf_event_open", "personality", "pivot_root",
        "process_vm_readv", "process_vm_writev", "query_module", "quotactl",
        "reboot", "request_key", "set_mempolicy", "setns", "settimeofday",
        "stime", "swapoff", "swapon", "sysfs", "syslog", "_sysctl",
        "umount", "umount2", "unshare", "uselib", "userfaultfd", "ustat",
        "vm86", "vm86old"
    ]
}

/// Generate a restrictive seccomp profile for malware analysis
///
/// This profile blocks dangerous syscalls while allowing monitoring tools (strace, tcpdump)
/// to function. It follows Docker's default seccomp profile with additional restrictions.
pub fn generate_seccomp_profile() -> Value {
    let allowed: Vec<Value> = allowed_syscalls().iter().map(|s| json!(s)).collect();
    let blocked: Vec<Value> = blocked_syscalls().iter().map(|s| json!(s)).collect();

    json!({
        "defaultAction": "SCMP_ACT_ERRNO",
        "defaultErrnoRet": 1,
        "archMap": [
            {
                "architecture": "SCMP_ARCH_X86_64",
                "subArchitectures": ["SCMP_ARCH_X86", "SCMP_ARCH_X32"]
            },
            {
                "architecture": "SCMP_ARCH_AARCH64",
                "subArchitectures": ["SCMP_ARCH_ARM"]
            }
        ],
        "syscalls": [
            {
                "names": allowed,
                "action": "SCMP_ACT_ALLOW"
            },
            {
                "names": ["ptrace"],
                "action": "SCMP_ACT_ALLOW"
            },
            {
                "names": blocked,
                "action": "SCMP_ACT_ERRNO",
                "errnoRet": 1
            }
        ]
    })
}

/// Convert seccomp profile to Docker-compatible JSON string
pub fn to_docker_seccomp_json() -> Result<String, serde_json::Error> {
    let profile = generate_seccomp_profile();
    serde_json::to_string(&profile)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_seccomp_profile() {
        let profile = generate_seccomp_profile();

        // Verify structure
        assert_eq!(profile["defaultAction"], "SCMP_ACT_ERRNO");
        assert!(profile["syscalls"].is_array());

        let syscalls = profile["syscalls"].as_array().unwrap();
        assert!(syscalls.len() > 0);

        // Verify allowed syscalls include basic operations
        let allowed = &syscalls[0];
        let names = allowed["names"].as_array().unwrap();
        assert!(names.iter().any(|n| n == "read"));
        assert!(names.iter().any(|n| n == "write"));
        assert!(names.iter().any(|n| n == "open"));
    }

    #[test]
    fn test_to_docker_seccomp_json() {
        let json_result = to_docker_seccomp_json();
        assert!(json_result.is_ok());

        let json_str = json_result.unwrap();
        assert!(json_str.contains("defaultAction"));
        assert!(json_str.contains("SCMP_ACT_ERRNO"));

        // Verify it's valid JSON
        let parsed: serde_json::Value = serde_json::from_str(&json_str).unwrap();
        assert_eq!(parsed["defaultAction"], "SCMP_ACT_ERRNO");
    }

    #[test]
    fn test_seccomp_blocks_dangerous_syscalls() {
        let profile = generate_seccomp_profile();
        let syscalls = profile["syscalls"].as_array().unwrap();

        // Find the blocked syscalls entry
        let blocked = syscalls.iter()
            .find(|s| s["action"] == "SCMP_ACT_ERRNO" && s["errnoRet"] == 1)
            .expect("Should have blocked syscalls section");

        let names = blocked["names"].as_array().unwrap();

        // Verify dangerous syscalls are blocked
        assert!(names.iter().any(|n| n == "mount"));
        assert!(names.iter().any(|n| n == "reboot"));
        assert!(names.iter().any(|n| n == "init_module"));
        assert!(names.iter().any(|n| n == "delete_module"));
        assert!(names.iter().any(|n| n == "kexec_load"));
    }

    #[test]
    fn test_seccomp_allows_ptrace() {
        let profile = generate_seccomp_profile();
        let syscalls = profile["syscalls"].as_array().unwrap();

        // Find ptrace entry
        let ptrace = syscalls.iter()
            .find(|s| {
                s["names"].as_array()
                    .and_then(|arr| arr.iter().find(|n| *n == "ptrace"))
                    .is_some()
            })
            .expect("Should have ptrace entry");

        assert_eq!(ptrace["action"], "SCMP_ACT_ALLOW");
    }
}
