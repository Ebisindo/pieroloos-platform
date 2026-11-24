# Pin the official Node 22 Bookworm multi-platform index digest.
FROM node:22-bookworm@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d
# Record the verified versions already present in this immutable base image.
# The runtime image is intentionally not downgraded; CI checks these exact versions.
ARG GIT_DEB_VERSION=1:2.39.5-0+deb12u2
ARG CA_CERTIFICATES_DEB_VERSION=20230311+deb12u1
RUN set -eu; \
    installed_git="$(dpkg-query -W -f='${Version}' git)"; \
    installed_ca="$(dpkg-query -W -f='${Version}' ca-certificates)"; \
    test "$installed_git" = "$GIT_DEB_VERSION"; \
    test "$installed_ca" = "$CA_CERTIFICATES_DEB_VERSION"; \
    git --version; \
    dpkg-query -W git ca-certificates
WORKDIR /workspace
CMD ["bash", "-l"]
