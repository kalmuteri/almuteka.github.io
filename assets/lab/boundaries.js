// p_tt + 2 sigma p_t = v² (Laplacian(p) + s). Outer edge: p = 0.
export function damping(nx, nz, width = 15, strength = 60, boundary = 'sponge') {
  const sigma = new Float32Array(nx * nz);
  if (boundary === 'reflecting') return sigma;
  for (let z=0; z<nz; z++) for (let x=0; x<nx; x++) {
    const d = Math.min(x, z, nx-1-x, nz-1-z);
    sigma[z*nx+x] = strength * Math.max(0, 1-d/width) ** 2;
  }
  return sigma;
}
