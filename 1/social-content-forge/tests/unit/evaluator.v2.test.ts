import { describe, it, expect } from 'vitest';
import {
  calculateWeightedScoreV2,
  checkVeto,
  getVetoDimensions,
  getDecisionPath,
} from '../../src/evaluator';

// We need to export these from evaluator for testing
// For now, we test the functions directly

describe('Nine-Dimension Evaluation', () => {
  describe('calculateWeightedScoreV2', () => {
    it('should calculate weighted score correctly', () => {
      const scores = {
        emotion: 8,
        utility: 8,
        narrative: 7,
        socialCurrency: 6,
        controversy: 5,
        timeliness: 7,
        differentiation: 6,
        shareability: 6,
        conversionPotential: 7,
      };
      const score = calculateWeightedScoreV2(scores);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 100 for all perfect scores', () => {
      const scores = {
        emotion: 10,
        utility: 10,
        narrative: 10,
        socialCurrency: 10,
        controversy: 10,
        timeliness: 10,
        differentiation: 10,
        shareability: 10,
        conversionPotential: 10,
      };
      const score = calculateWeightedScoreV2(scores);
      expect(score).toBe(100);
    });

    it('should return low score for poor content', () => {
      const scores = {
        emotion: 3,
        utility: 3,
        narrative: 3,
        socialCurrency: 3,
        controversy: 3,
        timeliness: 3,
        differentiation: 3,
        shareability: 3,
        conversionPotential: 3,
      };
      const score = calculateWeightedScoreV2(scores);
      expect(score).toBeLessThan(50);
    });
  });

  describe('checkVeto', () => {
    it('should return true when any score < 5', () => {
      const scores = {
        emotion: 8,
        utility: 8,
        narrative: 7,
        socialCurrency: 6,
        controversy: 4,
        timeliness: 7,
        differentiation: 6,
        shareability: 6,
        conversionPotential: 7,
      };
      expect(checkVeto(scores)).toBe(true);
    });

    it('should return false when all scores >= 5', () => {
      const scores = {
        emotion: 8,
        utility: 8,
        narrative: 7,
        socialCurrency: 6,
        controversy: 5,
        timeliness: 7,
        differentiation: 6,
        shareability: 6,
        conversionPotential: 7,
      };
      expect(checkVeto(scores)).toBe(false);
    });
  });

  describe('getVetoDimensions', () => {
    it('should return dimensions with score < 5', () => {
      const scores = {
        emotion: 8,
        utility: 8,
        narrative: 7,
        socialCurrency: 6,
        controversy: 4,
        timeliness: 7,
        differentiation: 6,
        shareability: 6,
        conversionPotential: 7,
      };
      const vetoed = getVetoDimensions(scores);
      expect(vetoed).toContain('controversy');
      expect(vetoed).not.toContain('emotion');
    });

    it('should return empty when no veto', () => {
      const scores = {
        emotion: 8,
        utility: 8,
        narrative: 7,
        socialCurrency: 6,
        controversy: 5,
        timeliness: 7,
        differentiation: 6,
        shareability: 6,
        conversionPotential: 7,
      };
      const vetoed = getVetoDimensions(scores);
      expect(vetoed.length).toBe(0);
    });
  });

  describe('getDecisionPath', () => {
    it('should return A for score >= 80', () => {
      expect(getDecisionPath(85)).toBe('A');
      expect(getDecisionPath(90)).toBe('A');
    });

    it('should return B for score 60-79', () => {
      expect(getDecisionPath(79)).toBe('B');
      expect(getDecisionPath(70)).toBe('B');
    });

    it('should return C for score < 60', () => {
      expect(getDecisionPath(59)).toBe('C');
      expect(getDecisionPath(40)).toBe('C');
    });
  });
});
