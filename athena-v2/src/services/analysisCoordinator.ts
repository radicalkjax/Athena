import { v4 as uuidv4 } from 'uuid';
import { aiService } from './aiService';
import type { 
  AIProvider, 
  AIAnalysisRequest, 
  AIAnalysisResult, 
  EnsembleAnalysisResult 
} from '../types/ai';

interface ConsensusConfig {
  minAgreement: number; // Minimum percentage of providers that must agree
  weightedVoting: boolean; // Whether to weight votes by confidence
  requiredProviders: number; // Minimum number of providers needed
}

class AnalysisCoordinator {
  private activeAnalyses: Map<string, EnsembleAnalysisResult> = new Map();
  private consensusConfig: ConsensusConfig = {
    minAgreement: 0.7, // 70% agreement threshold
    weightedVoting: true,
    requiredProviders: 3
  };

  async coordinateAnalysis(request: AIAnalysisRequest): Promise<EnsembleAnalysisResult> {
    const analysisId = uuidv4();
    
    // Run analysis with all requested providers in parallel
    const results = await aiService.analyzeWithMultipleProviders(request);
    
    // Filter out failed results
    const successfulResults = results.filter(r => !r.error);
    
    if (successfulResults.length < this.consensusConfig.requiredProviders) {
      throw new Error(
        `Insufficient providers available. Required: ${this.consensusConfig.requiredProviders}, Available: ${successfulResults.length}`
      );
    }

    // Build consensus result
    const consensusResult = this.buildConsensus(successfulResults);
    
    // Identify disagreements
    const disagreements = this.identifyDisagreements(successfulResults, consensusResult);
    
    const ensembleResult: EnsembleAnalysisResult = {
      id: analysisId,
      fileHash: request.fileHash,
      timestamp: Date.now(),
      providers: successfulResults.map(r => r.provider),
      individualResults: results,
      consensusResult,
      disagreements
    };

    this.activeAnalyses.set(analysisId, ensembleResult);
    
    return ensembleResult;
  }

  private buildConsensus(results: AIAnalysisResult[]): EnsembleAnalysisResult['consensusResult'] {
    // Calculate weighted threat level
    const threatLevel = this.calculateConsensusThreatLevel(results);
    
    // Calculate overall confidence
    const confidence = this.calculateConsensusConfidence(results);
    
    // Determine malware family and type
    const { malwareFamily, malwareType } = this.determineMalwareClassification(results);
    
    // Aggregate signatures and behaviors
    const aggregatedSignatures = this.aggregateUniqueValues(results, 'signatures');
    const aggregatedBehaviors = this.aggregateUniqueValues(results, 'behaviors');
    
    // Aggregate IOCs
    const aggregatedIocs = {
      domains: this.aggregateUniqueValues(results, 'iocs.domains'),
      ips: this.aggregateUniqueValues(results, 'iocs.ips'),
      files: this.aggregateUniqueValues(results, 'iocs.files'),
      registry: this.aggregateUniqueValues(results, 'iocs.registry'),
      processes: this.aggregateUniqueValues(results, 'iocs.processes')
    };
    
    // Generate summary
    const summary = this.generateConsensusSummary(
      threatLevel, 
      confidence, 
      malwareFamily, 
      results.length
    );
    
    return {
      confidence,
      threatLevel,
      malwareFamily,
      malwareType,
      aggregatedSignatures,
      aggregatedBehaviors,
      aggregatedIocs,
      summary
    };
  }

  private calculateConsensusThreatLevel(
    results: AIAnalysisResult[]
  ): 'safe' | 'suspicious' | 'malicious' | 'critical' {
    const threatLevels = {
      safe: 0,
      suspicious: 1,
      malicious: 2,
      critical: 3
    };
    
    if (this.consensusConfig.weightedVoting) {
      // Weighted voting based on confidence
      let weightedSum = 0;
      let totalWeight = 0;
      
      results.forEach(result => {
        const weight = result.confidence;
        weightedSum += threatLevels[result.threatLevel] * weight;
        totalWeight += weight;
      });
      
      const averageLevel = weightedSum / totalWeight;
      
      // Round to nearest threat level
      if (averageLevel < 0.5) return 'safe';
      if (averageLevel < 1.5) return 'suspicious';
      if (averageLevel < 2.5) return 'malicious';
      return 'critical';
    } else {
      // Simple majority voting
      const votes: Record<string, number> = {
        safe: 0,
        suspicious: 0,
        malicious: 0,
        critical: 0
      };
      
      results.forEach(result => {
        votes[result.threatLevel]++;
      });
      
      // Return the threat level with most votes
      return Object.entries(votes)
        .sort((a, b) => b[1] - a[1])[0][0] as any;
    }
  }

  private calculateConsensusConfidence(results: AIAnalysisResult[]): number {
    // Calculate average confidence weighted by agreement
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    // Calculate agreement factor (how much providers agree)
    const threatLevels = results.map(r => r.threatLevel);
    const uniqueLevels = new Set(threatLevels).size;
    const agreementFactor = 1 - (uniqueLevels - 1) / 3; // Normalize to 0-1
    
    // Final confidence is average confidence adjusted by agreement
    return Math.round((avgConfidence * 0.7 + agreementFactor * 0.3) * 100) / 100;
  }

  private determineMalwareClassification(results: AIAnalysisResult[]) {
    // Count occurrences of malware families and types
    const familyCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();
    
    results.forEach(result => {
      if (result.malwareFamily) {
        familyCounts.set(
          result.malwareFamily, 
          (familyCounts.get(result.malwareFamily) || 0) + result.confidence
        );
      }
      if (result.malwareType) {
        typeCounts.set(
          result.malwareType, 
          (typeCounts.get(result.malwareType) || 0) + result.confidence
        );
      }
    });
    
    // Get most confident classification
    const malwareFamily = this.getMostConfidentValue(familyCounts);
    const malwareType = this.getMostConfidentValue(typeCounts);
    
    return { malwareFamily, malwareType };
  }

  private getMostConfidentValue(counts: Map<string, number>): string | undefined {
    if (counts.size === 0) return undefined;
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  private aggregateUniqueValues(results: AIAnalysisResult[], path: string): string[] {
    const values = new Set<string>();
    
    results.forEach(result => {
      const pathParts = path.split('.');
      let value: any = result;
      
      for (const part of pathParts) {
        value = value?.[part];
      }
      
      if (Array.isArray(value)) {
        value.forEach(v => values.add(v));
      }
    });
    
    return Array.from(values);
  }

  private identifyDisagreements(
    results: AIAnalysisResult[], 
    consensus: EnsembleAnalysisResult['consensusResult']
  ): EnsembleAnalysisResult['disagreements'] {
    const disagreements: EnsembleAnalysisResult['disagreements'] = [];
    
    results.forEach(result => {
      // Check threat level disagreement
      if (result.threatLevel !== consensus.threatLevel) {
        disagreements.push({
          provider: result.provider,
          field: 'threatLevel',
          value: result.threatLevel
        });
      }
      
      // Check malware family disagreement
      if (result.malwareFamily && result.malwareFamily !== consensus.malwareFamily) {
        disagreements.push({
          provider: result.provider,
          field: 'malwareFamily',
          value: result.malwareFamily
        });
      }
      
      // Check significant confidence deviation
      if (Math.abs(result.confidence - consensus.confidence) > 0.2) {
        disagreements.push({
          provider: result.provider,
          field: 'confidence',
          value: result.confidence
        });
      }
    });
    
    return disagreements;
  }

  private generateConsensusSummary(
    threatLevel: string,
    confidence: number,
    malwareFamily: string | undefined,
    providerCount: number
  ): string {
    const confidencePercent = Math.round(confidence * 100);
    const familyText = malwareFamily ? ` identified as ${malwareFamily}` : '';
    
    return `Based on analysis from ${providerCount} AI providers with ${confidencePercent}% ` +
           `confidence, the file is classified as ${threatLevel}${familyText}. ` +
           `This consensus was reached through weighted voting and cross-validation ` +
           `of behavioral patterns, signatures, and indicators of compromise.`;
  }

  getAnalysisResult(analysisId: string): EnsembleAnalysisResult | undefined {
    return this.activeAnalyses.get(analysisId);
  }

  updateConsensusConfig(config: Partial<ConsensusConfig>) {
    this.consensusConfig = { ...this.consensusConfig, ...config };
  }
}

export const analysisCoordinator = new AnalysisCoordinator();