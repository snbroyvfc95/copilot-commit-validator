# Production Skip Directive Naming Guide

## 🏭 Production-Ready Naming Conventions

The AI Commit Validator v2.4.1+ supports production-appropriate skip directive naming that clearly communicates **intent**, **context**, and **business justification**.

## 📋 Directive Categories & Usage

### 🚨 **Emergency & Hotfix**
```javascript
// hotfix: no-review - [Brief description of critical issue]
// emergency: skip-validation - [Business impact description]
```

**When to use:**
- Security vulnerabilities (CVE fixes)
- Production outages affecting users
- Revenue-impacting bugs
- Regulatory compliance deadlines
- Data corruption recovery

**Examples:**
```javascript
// hotfix: no-review - CVE-2024-1234 XSS vulnerability in user input
const sanitizedInput = input.replace(/<script.*?>/gi, '');

// emergency: skip-validation - Payment gateway down, switching to backup
const paymentProvider = fallbackMode ? 'stripe' : 'paypal';
```

### 🏗️ **Generated & Build Code**
```javascript
// generated: no-validation - [Tool name and version]
```

**When to use:**
- Webpack/Vite/Rollup build outputs
- TypeScript declaration files
- API client generation (Swagger/OpenAPI)
- ORM migration files
- Auto-generated documentation

**Examples:**
```javascript
// generated: no-validation - Webpack 5.89.0 production build
module.exports = {
  // 500+ lines of generated configuration
};

// generated: no-validation - Prisma ORM migration 20241116_user_table
CREATE TABLE users (id SERIAL PRIMARY KEY, email VARCHAR(255));
```

### 🤝 **Third-Party Integration**
```javascript
// third-party: skip-review - [Vendor name and purpose]
```

**When to use:**
- Payment processor SDKs
- Analytics tracking code
- Social media widgets
- CDN configurations
- Vendor-prescribed code patterns

**Examples:**
```javascript
// third-party: skip-review - Stripe Elements integration per documentation
const elements = stripe.elements();
const cardElement = elements.create('card');

// third-party: skip-review - Google Analytics 4 tracking code
gtag('config', 'GA_MEASUREMENT_ID', {
  page_title: document.title,
  page_location: window.location.href
});
```

### 🧪 **Prototype & Experimental**
```javascript
// prototype: skip-checks - [MVP/experiment description]
```

**When to use:**
- A/B testing implementations
- Proof-of-concept features
- Hackathon projects
- User research MVPs
- Innovation experiments

**Examples:**
```javascript
// prototype: skip-checks - AI recommendation engine MVP for user testing
function experimentalRecommendations(userId) {
  // Quick implementation for gathering user feedback
  return recommendations.sort(() => Math.random() - 0.5);
}

// prototype: skip-checks - Voice interface POC for accessibility team
const speechRecognition = new SpeechRecognition();
```

### 📚 **Legacy Code Management**
```javascript
// legacy: no-validation - [Migration context and timeline]
```

**When to use:**
- Code from acquisitions
- Migration from other languages
- Maintaining backward compatibility
- Gradual refactoring projects
- Technical debt with migration plan

**Examples:**
```javascript
// legacy: no-validation - PHP codebase migration, refactor planned Q2 2025
var old_naming_convention = true;
if (old_naming_convention == true) {
  legacy_function_call();
}

// legacy: no-validation - Acquired from Acme Corp, maintaining compatibility
function legacyDataProcessor(data) {
  // Original implementation preserved during transition
}
```

### ⚙️ **General Purpose**
```javascript
// ai-review: skip - [Specific reason]
// commit-validator: bypass - [Context]
```

**When to use:**
- Custom scenarios not covered above
- Team-specific workflows
- Temporary overrides with explanation

## 🎯 Best Practice Examples

### ✅ **Good Directive Usage**
```javascript
// hotfix: no-review - Critical memory leak in user session management
// Impact: 99.9% CPU usage causing site outage
// Ticket: URGENT-2024-1156
const sessions = new Map(); // Fixed: Use Map instead of object for sessions

// generated: no-validation - Swagger Codegen 3.0.34 from OpenAPI spec
// Auto-generated client for payments API v2.1
export class PaymentsApiClient {
  // 1000+ lines of generated TypeScript
}

// third-party: skip-review - Salesforce Integration per vendor documentation  
// Required patterns that don't match our style guide
var sforce = new sforce.SObject("Account");
sforce.set("Name", accountName);

// prototype: skip-checks - ML recommendation engine for user research
// MVP for gathering feedback, production version planned for Q3
function quickRecommendations(preferences) {
  return items.filter(item => preferences.includes(item.category));
}

// legacy: no-validation - Inherited from PHP system, TypeScript migration Q2 2025
// Maintaining exact behavior during transition period  
var user_data = getUserData();
if (user_data != null && user_data != undefined) {
  processUserData(user_data);
}
```

### ❌ **Poor Directive Usage**
```javascript
// ai-review: skip - I don't like the suggestions
// (Missing business justification)

// hotfix: no-review - Quick fix
// (Too vague, no context about impact or urgency)

// skip validation please
// (Not using standard format, unclear intent)

// TODO: fix this later // validator: skip  
// (Using skip to avoid addressing technical debt)
```

## 🔧 Configuration & Customization

### Custom Patterns
Define your own organization-specific patterns:

```bash
# Custom directive for compliance scenarios
export AI_SKIP_DIRECTIVE_REGEX="//\\s*(sox-compliance|gdpr-urgent|audit-exception)\\s*:\\s*skip"
```

### Team Guidelines Template
```javascript
// [CATEGORY]: [ACTION] - [BUSINESS_CONTEXT]
// 
// Categories: hotfix, emergency, generated, third-party, prototype, legacy
// Actions: no-review, skip-validation, no-validation, skip-review, skip-checks, bypass
// Business Context: Brief explanation of why skip is necessary
//
// Examples:
// hotfix: no-review - Payment processor timeout causing checkout failures
// generated: no-validation - TypeScript definitions from GraphQL schema
// legacy: no-validation - Gradual migration from monolith, Q3 2025 completion
```

## 🏢 Enterprise Integration

### Audit Trail
Skip directives create an audit trail in your codebase:

```javascript
// hotfix: no-review - INCIDENT-2024-1156 database connection pool exhaustion
// Approved by: Tech Lead (john.doe@company.com)
// Business Impact: 500+ users unable to login
// Rollback Plan: Revert commit abc123 if issues arise
const maxConnections = process.env.NODE_ENV === 'production' ? 100 : 10;
```

### CI/CD Integration
Track skip directive usage in your pipeline:

```yaml
# .github/workflows/audit-skips.yml
- name: Audit Skip Directives
  run: |
    echo "📊 Skip Directive Usage Report"
    grep -r "hotfix:\\|emergency:\\|prototype:" src/ | wc -l
    echo "🚨 Review these skips before production deployment"
```

### Compliance Reporting
Generate reports for security/compliance teams:

```bash
# Monthly skip directive report
git log --since="1 month ago" --grep="hotfix:\\|emergency:" --oneline > monthly_skips.txt
```

## 📈 Impact & Metrics

**Benefits of Production Naming:**
- ✅ **Clear Intent**: Teams understand why validation was skipped
- ✅ **Audit Trail**: Compliance and security teams can track usage
- ✅ **Business Context**: Connects code changes to business impact
- ✅ **Migration Planning**: Legacy directives help plan technical debt
- ✅ **Process Improvement**: Patterns reveal workflow optimization opportunities

**Tracking Success:**
- Monitor skip directive usage frequency by category
- Measure time-to-resolution for hotfix scenarios
- Track completion of legacy code migrations
- Review prototype-to-production conversion rates

This production-ready approach ensures skip directives enhance rather than undermine your development workflow and code quality standards.