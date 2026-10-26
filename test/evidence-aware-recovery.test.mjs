/* CI and local npm test must execute the same offline, fail-closed
   recovery assurance scenarios as Control Retry itself. The autonomous
   controller is NOT proof of a healthy screening run: these are synthetic
   software tests only. Keeping this wrapper under test/ makes
   test/ci-coverage.test.mjs enforce an explicit ci.yml entry. */
import '../scripts/evidence-aware-recovery-selftest.mjs';
