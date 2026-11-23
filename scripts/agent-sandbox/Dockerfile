# Pin the official Node 22 Bookworm multi-platform index digest.
# Verified against Docker Hub's official library/node image metadata.
FROM node:22-bookworm@sha256:8a34c4ab3ea2c5cd194f07e317b2a8f09461d3c8b05c4e34c8ccd56d56024c4d
# Keep OS packages pinned to the Debian repository versions selected for this image.
# A future package-index refresh must update these versions deliberately and pass CI.
ARG GIT_DEB_VERSION=1:2.39.5-0+deb12u2
ARG CA_CERTIFICATES_DEB_VERSION=20230311+deb12u1
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git="${GIT_DEB_VERSION}" \
    ca-certificates="${CA_CERTIFICATES_DEB_VERSION}" \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
CMD ["bash", "-l"]
