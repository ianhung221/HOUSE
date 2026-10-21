import { identity } from '../config/identity';
import type { HomeProject } from './types';

// A one-way legacy ID fingerprint permits old backups without publishing their label.
const legacyIdFingerprint = '694345b349285b5d7d2ebbf1c7851f4892ed20c04d194c0c45b775e2296c5cc8';
export async function isCompatibleProject(project: HomeProject): Promise<boolean> {
  if (project.rooms.filter(r => r.kind === 'bath').length !== 3 || project.rooms.filter(r => r.kind === 'bedroom').length !== 3) return false;
  if (project.id === identity.projectId || project.id === 'home-plan-v1') return true;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(project.id));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('') === legacyIdFingerprint;
}
