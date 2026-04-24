import LogisticRegression from 'ml-logistic-regression';

/**
 * Builds a logistic regression surrogate model to understand hiring decisions.
 * The model is trained on candidate features to learn patterns and enable
 * counterfactual analysis.
 *
 * @param {Array<Object>} candidates - Array of classified candidates with decisions
 * @param {number} candidates[].skillScore - Skill score 0-100
 * @param {number} candidates[].collegeTier - College tier 1-4
 * @param {number} candidates[].cityTier - City tier 1-3
 * @param {Object} candidates[].surnameScore - Surname score object
 * @param {number} candidates[].gapScore - Gap score 0.0-1.0
 * @param {number} candidates[].companyTier - Company tier 2-3
 * @param {string} candidates[].decision - "hired" or "rejected"
 * @returns {Object} Model result with trained model, accuracy, and metadata
 */
export function buildModel(candidates) {
  // Validate minimum batch size
  if (!candidates || candidates.length < 50) {
    return {
      error: true,
      message: `Minimum 50 candidates needed for counterfactual analysis. Current: ${candidates?.length || 0}`,
      current: candidates?.length || 0
    };
  }

  try {
    // Build feature matrix
    const features = candidates.map(candidate => [
      (candidate.skillScore || 0) / 100,
      (4 - (candidate.collegeTier || 3)) / 3,
      (4 - (candidate.cityTier || 3)) / 3,
      candidate.surnameScore?.score || 0.5,
      candidate.gapScore || 1.0,
      (3 - (candidate.companyTier || 3)) / 2
    ]);

    // Build labels array
    const labels = candidates.map(candidate =>
      candidate.decision === 'hired' ? 1 : 0
    );

    // Split 80% train, 20% test
    const splitIndex = Math.floor(candidates.length * 0.8);
    const trainFeatures = features.slice(0, splitIndex);
    const trainLabels = labels.slice(0, splitIndex);
    const testFeatures = features.slice(splitIndex);
    const testLabels = labels.slice(splitIndex);

    // Train logistic regression model
    const model = new LogisticRegression({
      numSteps: 1000,
      learningRate: 5e-3
    });
    model.train(trainFeatures, trainLabels);

    // Calculate accuracy on test set
    let correctPredictions = 0;
    testFeatures.forEach((features, index) => {
      const prediction = model.predict([features])[0];
      const predicted = prediction > 0.5 ? 1 : 0;
      if (predicted === testLabels[index]) {
        correctPredictions++;
      }
    });
    const accuracy = testFeatures.length > 0 
      ? (correctPredictions / testFeatures.length) * 100 
      : 0;

    return {
      model,
      accuracy: Math.round(accuracy),
      featureNames: [
        'skillScore',
        'collegeTier',
        'cityTier',
        'surname',
        'gapScore',
        'companyTier'
      ],
      batchSize: candidates.length,
      error: false,
      trainSize: trainFeatures.length,
      testSize: testFeatures.length
    };
  } catch (error) {
    return {
      error: true,
      message: `Failed to build model: ${error.message}`,
      current: candidates.length
    };
  }
}

/**
 * Generates a counterfactual explanation for a rejected candidate.
 * Shows what would need to change for the candidate to be selected.
 *
 * @param {Object} candidate - Single classified candidate
 * @param {Object} modelResult - Result from buildModel function
 * @param {number} skillThreshold - Minimum skill score to be considered qualified (default 60)
 * @returns {Object} Counterfactual explanation or availability status
 */
export function generateCounterfactual(candidate, modelResult, skillThreshold = 60) {
  // Check for model errors
  if (!modelResult || modelResult.error) {
    return {
      available: false,
      reason: 'model_error',
      message: modelResult?.message || 'Model not available'
    };
  }

  // Don't generate for hired candidates
  if (candidate.decision === 'hired') {
    return {
      available: false,
      reason: 'candidate_hired',
      message: 'Counterfactuals only generated for rejected candidates'
    };
  }

  // Check skill qualification first
  if ((candidate.skillScore || 0) < skillThreshold) {
    const name = candidate.parsed_data?.full_name || 'Candidate';
    return {
      available: true,
      reason: 'skills',
      explanation: `${name} did not meet the minimum skill requirements for this role. Skill score: ${candidate.skillScore || 0}/100. Required: ${skillThreshold}/100.`
    };
  }

  try {
    // Build current feature vector
    const currentFeatures = [
      (candidate.skillScore || 0) / 100,
      (4 - (candidate.collegeTier || 3)) / 3,
      (4 - (candidate.cityTier || 3)) / 3,
      candidate.surnameScore?.score || 0.5,
      candidate.gapScore || 1.0,
      (3 - (candidate.companyTier || 3)) / 2
    ];

    // Get current prediction
    const currentProbability = modelResult.model.predict([currentFeatures])[0];

    // Feature names and index mapping
    const featureConfig = [
      { index: 0, name: 'skillScore', label: 'Skill Score', readonly: true },
      { index: 1, name: 'collegeTier', label: 'College Tier', optimalValue: 1.0, desc: 'Top-tier college' },
      { index: 2, name: 'cityTier', label: 'Home City', optimalValue: 1.0, desc: 'Metro city' },
      { index: 3, name: 'surname', label: 'Surname', optimalValue: 1.0, desc: 'Non-flagged name' },
      { index: 4, name: 'gapScore', label: 'Employment Gap', optimalValue: 1.0, desc: 'No gaps' },
      { index: 5, name: 'companyTier', label: 'Previous Company', optimalValue: 1.0, desc: 'Top-tier company' }
    ];

    // Try changing each proxy feature to find what would flip the decision
    for (const feature of featureConfig) {
      if (feature.readonly) continue;

      // Create modified feature vector
      const modifiedFeatures = [...currentFeatures];
      modifiedFeatures[feature.index] = feature.optimalValue;

      // Get prediction with modified feature
      const modifiedProbability = modelResult.model.predict([modifiedFeatures])[0];

      // If this change flips the outcome
      if (modifiedProbability > 0.5 && currentProbability <= 0.5) {
        const name = candidate.parsed_data?.full_name || 'Candidate';
        
        // Get human-readable original and counterfactual values
        let originalValue = '';
        let counterfactualValue = '';

        if (feature.name === 'collegeTier') {
          const tierLabels = { 1: 'Tier 1', 2: 'Tier 2', 3: 'Tier 3', 4: 'Tier 4' };
          originalValue = tierLabels[candidate.collegeTier || 3] || 'Tier 3';
          counterfactualValue = 'Tier 1';
        } else if (feature.name === 'cityTier') {
          const tierLabels = { 1: 'Tier 1 Metro', 2: 'Tier 2 City', 3: 'Tier 3 City' };
          originalValue = tierLabels[candidate.cityTier || 3] || 'Tier 3 City';
          counterfactualValue = 'Tier 1 Metro';
        } else if (feature.name === 'surname') {
          originalValue = `Flagged as ${candidate.surnameScore?.flagged ? 'ambiguous' : 'specific'}`;
          counterfactualValue = 'Non-flagged';
        } else if (feature.name === 'gapScore') {
          originalValue = `Gap score: ${(candidate.gapScore || 1.0).toFixed(2)}`;
          counterfactualValue = 'No employment gaps';
        } else if (feature.name === 'companyTier') {
          originalValue = `Tier ${candidate.companyTier || 3}`;
          counterfactualValue = 'Top-tier company';
        }

        return {
          available: true,
          reason: 'proxy',
          changedFeature: feature.label,
          originalValue,
          counterfactualValue,
          modelAccuracy: modelResult.accuracy,
          batchSize: modelResult.batchSize,
          explanation: `${name} would have been SELECTED if their ${feature.label.toLowerCase()} had been ${counterfactualValue}. All technical qualifications were above the selection threshold (${candidate.skillScore}/100 vs ${skillThreshold} required). The only blocking factor was ${feature.label.toLowerCase()} — which is not a measure of job performance.`
        };
      }
    }

    // If no single feature flip works
    return {
      available: true,
      reason: 'multiple_proxies',
      explanation: 'Multiple background factors combined to affect this decision. This indicates compound proxy bias where no single background change would result in selection. The candidate meets skill requirements but disadvantaged across multiple dimensions (education background, location, or company history).'
    };
  } catch (error) {
    return {
      available: false,
      reason: 'generation_error',
      message: `Failed to generate counterfactual: ${error.message}`
    };
  }
}

/**
 * Calculates the contribution of each feature to a candidate's prediction score.
 * Shows how much each feature helped or hurt the hiring decision.
 *
 * @param {Object} candidate - Single classified candidate
 * @param {Object} modelResult - Result from buildModel function
 * @returns {Object} Feature contributions (positive = helps selection, negative = hurts selection)
 */
export function getFeatureContributions(candidate, modelResult) {
  if (!modelResult || !modelResult.model) {
    return null;
  }

  try {
    // Build feature vector
    const features = [
      (candidate.skillScore || 0) / 100,
      (4 - (candidate.collegeTier || 3)) / 3,
      (4 - (candidate.cityTier || 3)) / 3,
      candidate.surnameScore?.score || 0.5,
      candidate.gapScore || 1.0,
      (3 - (candidate.companyTier || 3)) / 2
    ];

    // Get model coefficients
    const coefficients = modelResult.model.weights || [];

    // Feature names
    const featureNames = [
      'skillScore',
      'collegeTier',
      'cityTier',
      'surname',
      'gapScore',
      'companyTier'
    ];

    // Calculate contributions
    const contributions = {};
    featureNames.forEach((name, index) => {
      const coefficient = coefficients[index] || 0;
      const featureValue = features[index];
      const contribution = Math.round(featureValue * coefficient * 100);
      contributions[name] = contribution;
    });

    return contributions;
  } catch (error) {
    console.error('Error calculating feature contributions:', error);
    return null;
  }
}

/**
 * Gets human-readable feature importance ranking
 * Shows which features most impact hiring decisions in the learned model.
 *
 * @param {Object} modelResult - Result from buildModel function
 * @returns {Array} Sorted array of features by importance
 */
export function getFeatureImportance(modelResult) {
  if (!modelResult || !modelResult.model) {
    return [];
  }

  try {
    const coefficients = modelResult.model.weights || [];
    const featureNames = modelResult.featureNames || [];

    const importance = featureNames.map((name, index) => ({
      feature: name,
      importance: Math.abs(coefficients[index] || 0),
      direction: (coefficients[index] || 0) > 0 ? 'positive' : 'negative'
    }));

    return importance.sort((a, b) => b.importance - a.importance);
  } catch (error) {
    console.error('Error calculating feature importance:', error);
    return [];
  }
}

export default {
  buildModel,
  generateCounterfactual,
  getFeatureContributions,
  getFeatureImportance
};
