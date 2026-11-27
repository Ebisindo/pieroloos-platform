# Pin the official Node 22 Bookworm multi-platform index digest.
FROM node:22-bookworm@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d
# The immutable Node base image supplies Node, Git and CA certificates.
# Do not refresh apt indexes or silently change/downgrade operating-system packages here.
# To refresh OS packages, update the base-image digest through a separate reviewed change.
RUN set -eu; \
    command -v node; \
    command -v git; \
    command -v bash; \
    command -v tar; \
    command -v dpkg-query; \
    node --version; \
    git --version; \
    dpkg-query -W -f='${Package}=${Version}\n' git ca-certificates
WORKDIR /workspace
CMD ["bash", "-l"]
