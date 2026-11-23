# Pin the runtime base image by digest. Update deliberately with a reviewed digest.
FROM node:22-bookworm@sha256:6c9b3c2a6a2b9d8a48ee2f4f5d4a8f8f9bbd1c12c4c39a4b4a7c8e5f2c3d1e0f
ARG GIT_DEB_VERSION=1:2.39.5-0+deb12u2
ARG CA_CERTIFICATES_DEB_VERSION=20230311+deb12u1
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    git="${GIT_DEB_VERSION}" \
    ca-certificates="${CA_CERTIFICATES_DEB_VERSION}" \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
CMD ["bash", "-l"]
