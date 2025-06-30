export class SimilarityCalculator {
  static calculateSimilarityScore(original: string, candidate: string): number {
    if (original === candidate) return 1.0;
    
    const originalLower = original.toLowerCase();
    const candidateLower = candidate.toLowerCase();
    
    if (candidateLower.includes(originalLower) || originalLower.includes(candidateLower)) {
      return 0.9;
    }
    
    const distance = this.levenshteinDistance(originalLower, candidateLower);
    const maxLength = Math.max(original.length, candidate.length);
    
    return Math.max(0, 1 - (distance / maxLength));
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    if (str1.length === 0) return str2.length;
    if (str2.length === 0) return str1.length;

    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}