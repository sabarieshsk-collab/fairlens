import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

/**
 * ErrorBoundary - Catches React component errors
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log error for debugging
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-paper flex items-center justify-center px-4">
          <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent-light mb-4">
              <XMarkIcon className="w-6 h-6 text-accent" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-ink mb-2">Something Went Wrong</h1>
            <p className="text-ink-muted mb-6">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            {this.state.error && (
              <div className="bg-paper rounded p-4 mb-6 border border-rule max-h-32 overflow-y-auto">
                <p className="font-mono text-xs text-ink-muted">{this.state.error.toString()}</p>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-accent text-white font-bold rounded-lg hover:opacity-90 transition"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * SmallBatchWarning - Shows when candidate batch < 50
 */
export function SmallBatchWarning({ candidateCount }) {
  return (
    <div className="mb-6 p-4 bg-warn-light border-l-4 border-warn rounded-lg">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-warn flex-shrink-0 mt-0.5" />
        <div className="flex-grow">
          <p className="text-warn font-bold mb-1">
            ⚠️ Small batch detected ({candidateCount} candidates)
          </p>
          <p className="text-sm text-warn-muted">
            Results have lower statistical confidence. Minimum 50 candidates recommended for legally defensible audit documentation.
          </p>
          <div className="mt-3 inline-block px-2 py-1 bg-warn text-white text-xs font-bold rounded">
            LOW CONFIDENCE
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * InsufficientGroupWarning - Shows for groups < 30 candidates
 */
export function InsufficientGroupWarning({ metric, group, count }) {
  return (
    <div className="p-4 bg-gray-100 rounded-lg border border-gray-300 opacity-75">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-gray-600 font-medium mb-2">
            ⚠️ Only {count} candidates in {group}
          </p>
          <p className="text-xs text-gray-500">
            Insufficient for this metric. Excluded from calculation.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * NoBiasDetected - Shows full-width green banner when no bias found
 */
export function NoBiasDetected({ candidateCount, modelConfidence }) {
  return (
    <div className="mb-6 p-6 bg-success-light border-l-4 border-success rounded-lg">
      <div className="flex items-start gap-3 mb-4">
        <div className="text-2xl">✅</div>
        <div className="flex-grow">
          <h3 className="font-bold text-success mb-1">
            No Statistically Significant Bias Detected
          </h3>
          <p className="text-sm text-success-muted mb-3">
            This hiring cycle shows fairness across all measured dimensions.
          </p>
          <p className="text-xs text-success-muted">
            Based on {candidateCount} candidates with {modelConfidence}% model confidence
          </p>
        </div>
      </div>
      <div className="bg-white rounded p-3 inline-block">
        <p className="text-xs text-ink-muted">
          💡 <strong>Valuable Documentation:</strong> A clean audit is important compliance documentation. Consider generating your compliance report.
        </p>
      </div>
    </div>
  );
}

/**
 * AmbiguousSurname - Small note for ambiguous surnames
 */
export function AmbiguousSurname() {
  return (
    <div className="mt-2 flex items-start gap-2">
      <InformationCircleIcon className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
      <p className="text-xs text-ink-muted">
        Surname analysis inconclusive — regional variation detected. Excluded from surname proxy metrics.
      </p>
    </div>
  );
}

/**
 * ComplianceReportDisabledTooltip - Tooltip for disabled compliance report button
 */
export function ComplianceReportDisabledTooltip() {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-ink text-white text-xs rounded opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
      Compliance reports require minimum 50 candidates for statistical validity
    </div>
  );
}

export default ErrorBoundary;
