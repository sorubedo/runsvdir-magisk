FROM debian:13

ENV DEBIAN_FRONTEND=noninteractive

# ── system packages ──────────────────────────────────────────────
RUN apt-get update \
    && apt-get install -y \
        bash-completion \
        build-essential \
        bubblewrap \
        ca-certificates \
        clang \
        cmake \
        curl \
        file \
        git \
        lld \
        llvm \
        locales \
        meson \
        ninja-build \
        nodejs \
        npm \
        openssh-client \
        pkg-config \
        unzip \
        zip \
        lftp \
        android-platform-tools-base \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── locale ───────────────────────────────────────────────────────
RUN echo "en_US.UTF-8 UTF-8" > /etc/locale.gen \
    && echo "zh_CN.UTF-8 UTF-8" >> /etc/locale.gen \
    && locale-gen

ENV LANG=en_US.UTF-8 \
    LC_CTYPE=en_US.UTF-8 \
    PATH="/root/.local/bin:${PATH}"

# ── OpenCode ─────────────────────────────────────────────────────
RUN curl -fsSL https://opencode.ai/install | bash

# ── Codex ────────────────────────────────────────────────────────
RUN npm install -g @openai/codex \
    && npm cache clean --force

# ── CC Switch ────────────────────────────────────────────────────
RUN curl -fsSL \
        https://github.com/SaladDay/cc-switch-cli/releases/latest/download/install.sh \
    | bash \
    && cc-switch completions install --shell bash

# ── Android NDK ──────────────────────────────────────────────────
ARG NDK_VERSION=r27d
ENV ANDROID_NDK_HOME=/opt/android-ndk \
    ANDROID_NDK_ROOT=/opt/android-ndk

RUN curl -sL --connect-timeout 10 --max-time 600 \
        -o /tmp/android-ndk-${NDK_VERSION}-linux.zip \
        "https://dl.google.com/android/repository/android-ndk-${NDK_VERSION}-linux.zip" \
    && unzip -qo /tmp/android-ndk-${NDK_VERSION}-linux.zip -d /opt \
    && rm /tmp/android-ndk-${NDK_VERSION}-linux.zip \
    && ln -s /opt/android-ndk-${NDK_VERSION} ${ANDROID_NDK_HOME}

# ── NDK toolchain configs ────────────────────────────────────────
COPY android-ndk-env.sh      /opt/android-ndk-env.sh
COPY android-toolchain.cmake /opt/android-toolchain.cmake
COPY android-cross/          /opt/android-cross/

ENV PATH="${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin:${PATH}"

WORKDIR /workspaces
