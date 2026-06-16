# TopicAnalysisSchema

{
  "keyword": "string",
  "subTopics": [{ "name": "string", "description": "string", "heatLevel": "high|medium|low" }],
  "painPoints": [{ "description": "string", "targetAudience": "string", "emotionalTrigger": "string" }],
  "trendingAngles": [{ "angle": "string", "whyTrending": "string", "suitablePlatforms": ["string"] }],
  "controversies": [{ "topic": "string", "sideA": "string", "sideB": "string" }],
  "targetDemographics": [{ "group": "string", "interests": ["string"], "contentPreferences": ["string"] }],
  "competitorInsights": {
    "coveredAngles": [{ "angle": "string", "sourceTitle": "string", "platform": "string" }],
    "opportunityAngles": [{ "angle": "string", "whyOpportunity": "string" }],
    "warning": "string"
  }
}