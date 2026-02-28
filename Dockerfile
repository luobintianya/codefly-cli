FROM docker.io/library/node:20-slim

ARG SANDBOX_NAME="codefly-cli-sandbox"
ARG CLI_VERSION_ARG
ENV SANDBOX="$SANDBOX_NAME"
ENV CLI_VERSION=$CLI_VERSION_ARG

# install minimal set of packages, then clean up
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  man-db \
  curl \
  dnsutils \
  less \
  jq \
  bc \
  gh \
  git \
  unzip \
  rsync \
  ripgrep \
  procps \
  psmisc \
  lsof \
  socat \
  ca-certificates \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# set up npm global package folder under /usr/local/share
# give it to non-root user node, already set up in base image
RUN mkdir -p /usr/local/share/npm-global \
  && chown -R node:node /usr/local/share/npm-global
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin

# switch to non-root user node
USER node

# install codefly-cli and clean up
COPY packages/cli/dist/google-codefly-cli-*.tgz /tmp/codefly-cli.tgz
COPY packages/core/dist/google-codefly-cli-core-*.tgz /tmp/codefly-core.tgz
RUN npm install -g /tmp/codefly-core.tgz \
  && npm install -g /tmp/codefly-cli.tgz \
  && node -e "const fs=require('node:fs'); JSON.parse(fs.readFileSync('/usr/local/share/npm-global/lib/node_modules/@codeflyai/codefly/package.json','utf8')); JSON.parse(fs.readFileSync('/usr/local/share/npm-global/lib/node_modules/@codeflyai/codefly-core/package.json','utf8'));" \
  && codefly --version > /dev/null \
  && npm cache clean --force \
  && rm -f /tmp/codefly-{cli,core}.tgz

# default entrypoint when none specified
CMD ["codefly"]
