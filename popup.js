// Enhanced Popup.js - Advanced Fiverr Keyword Analysis
class FiverrKeywordInsightAI {
  constructor() {
    this.currentData = null;
    this.charts = {};
    this.realTimeInterval = null;
    this.searchCount = 0;
    this.lastUpdateTime = null;
    this.isAnalyzing = false;
    this.cachedData = new Map();
    this.trendingKeywords = [];
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadUserData();
    this.startRealTimeUpdates();
    this.loadTrendingKeywords();
    this.updateRealTimeIndicator();
  }

  bindEvents() {
    // Enhanced search functionality
    document.getElementById('searchBtn').addEventListener('click', () => this.analyzeKeyword());
    document.getElementById('keywordInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.analyzeKeyword();
    });
    
    // Real-time suggestions
    document.getElementById('keywordInput').addEventListener('input', (e) => {
      this.getSmartSuggestions(e.target.value);
    });

    // Enhanced action buttons
    document.getElementById('exportBtn').addEventListener('click', () => this.exportAdvancedData());
    document.getElementById('favoriteBtn').addEventListener('click', () => this.saveToFavorites());
    document.getElementById('overlayBtn').addEventListener('click', () => this.toggleOverlay());
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshAnalysis());
    
    // Chart controls
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchChartView(e.target.dataset.chart));
    });

    // Gigs sorting
    document.getElementById('gigsSort').addEventListener('change', (e) => {
      this.sortGigs(e.target.value);
    });

    // Load more gigs
    document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMoreGigs());

    // Trending keywords refresh
    document.getElementById('refreshTrending').addEventListener('click', () => this.loadTrendingKeywords());

    // Sidebar controls
    document.getElementById('clearFavorites').addEventListener('click', () => this.clearFavorites());
    document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());
    document.getElementById('refreshTrends').addEventListener('click', () => this.refreshMarketTrends());

    // Error handling
    document.getElementById('errorRetry').addEventListener('click', () => this.retryLastOperation());

    // Focus management
    document.getElementById('keywordInput').addEventListener('focus', () => {
      if (document.getElementById('keywordInput').value) {
        this.getSmartSuggestions(document.getElementById('keywordInput').value);
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-section')) {
        document.getElementById('suggestionsContainer').style.display = 'none';
      }
    });
  }

  async getSmartSuggestions(query) {
    if (query.length < 2) {
      document.getElementById('suggestionsContainer').style.display = 'none';
      return;
    }

    try {
      // Check cache first
      const cacheKey = `suggestions_${query}`;
      if (this.cachedData.has(cacheKey)) {
        const cached = this.cachedData.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
          this.displaySmartSuggestions(cached.data);
          return;
        }
      }

      const response = await chrome.runtime.sendMessage({
        action: 'getSmartSuggestions',
        keyword: query,
        includeTrending: true
      });

      if (response.suggestions && response.suggestions.length > 0) {
        // Cache the results
        this.cachedData.set(cacheKey, {
          data: response.suggestions,
          timestamp: Date.now()
        });
        
        this.displaySmartSuggestions(response.suggestions);
      }
    } catch (error) {
      console.error('Error getting smart suggestions:', error);
    }
  }

  displaySmartSuggestions(suggestions) {
    const container = document.getElementById('suggestionsContainer');
    const list = document.getElementById('suggestionsList');
    const count = document.getElementById('suggestionsCount');
    
    list.innerHTML = '';
    count.textContent = suggestions.length;
    
    suggestions.slice(0, 10).forEach((suggestion, index) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      
      // Add trending indicator for popular keywords
      const isTrending = suggestion.trending || false;
      const difficulty = suggestion.difficulty || 'medium';
      
      item.innerHTML = `
        <div class="suggestion-content">
          <span class="suggestion-text">${this.escapeHtml(suggestion.text)}</span>
          <div class="suggestion-meta">
            ${isTrending ? '<span class="trending-badge">🔥</span>' : ''}
            <span class="difficulty-badge ${difficulty}">${difficulty}</span>
          </div>
        </div>
        <div class="suggestion-stats">
          <span class="suggestion-competition">${suggestion.competition || 'N/A'}</span>
        </div>
      `;
      
      item.addEventListener('click', () => {
        document.getElementById('keywordInput').value = suggestion.text;
        container.style.display = 'none';
        this.analyzeKeyword();
      });
      
      list.appendChild(item);
    });

    container.style.display = 'block';
  }

  async analyzeKeyword() {
    const keyword = document.getElementById('keywordInput').value.trim();
    if (!keyword) {
      this.showError('Please enter a keyword to analyze', 'Input Required');
      return;
    }

    if (this.isAnalyzing) {
      this.showError('Analysis already in progress', 'Please Wait');
      return;
    }

    this.isAnalyzing = true;
    this.showLoading(true, 'Analyzing keyword data...');
    this.hideError();
    
    try {
      // Update search count
      this.searchCount++;
      document.getElementById('totalSearches').textContent = this.searchCount;

      // Check cache first
      const cacheKey = `analysis_${keyword}`;
      let response;
      
      if (this.cachedData.has(cacheKey)) {
        const cached = this.cachedData.get(cacheKey);
        if (Date.now() - cached.timestamp < 600000) { // 10 minutes cache
          response = { data: cached.data };
        }
      }

      if (!response) {
        response = await chrome.runtime.sendMessage({
          action: 'analyzeKeyword',
          keyword: keyword,
          includeAIInsights: true,
          includeCompetitionAnalysis: true,
          includeOpportunityKeywords: true
        });

        // Cache the results
        this.cachedData.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
      }

      if (response.error) {
        this.showError(response.error, 'Analysis Failed');
        return;
      }

      this.currentData = response.data;
      this.displayAdvancedResults(response.data, keyword);
      this.saveToHistory(keyword);
      this.updateLastUpdateTime();
      
      // Enable action buttons
      document.getElementById('exportBtn').disabled = false;
      document.getElementById('favoriteBtn').disabled = false;
      document.getElementById('refreshBtn').disabled = false;

      // Hide suggestions
      document.getElementById('suggestionsContainer').style.display = 'none';

      this.showSuccess('Analysis completed successfully!', 'Success');

    } catch (error) {
      console.error('Analysis error:', error);
      this.showError(this.getErrorMessage(error), 'Analysis Error');
    } finally {
      this.isAnalyzing = false;
      this.showLoading(false);
    }
  }

  displayAdvancedResults(data, keyword) {
    const container = document.getElementById('resultsContainer');
    
    // Update enhanced overview stats
    this.updateOverviewStats(data);
    
    // Display AI insights
    this.displayAIInsights(data);
    
    // Display competition analysis
    this.displayCompetitionAnalysis(data);
    
    // Display opportunity keywords
    this.displayOpportunityKeywords(data);
    
    // Display enhanced gigs
    this.displayEnhancedGigs(data.gigs);
    
    // Create advanced charts
    this.createAdvancedCharts(data);
    
    container.style.display = 'block';
  }

  updateOverviewStats(data) {
    document.getElementById('totalGigs').textContent = data.gigs.length;
    
    const competitionLevel = data.competition ? data.competition.level : this.calculateCompetitionLevel(data.gigs.length);
    document.getElementById('competitionLevel').textContent = competitionLevel;
    
    const avgPrice = data.performanceMetrics ? `$${data.performanceMetrics.avgPrice}` : this.calculateAvgPrice(data.gigs);
    document.getElementById('avgPrice').textContent = avgPrice;

    const avgRating = data.performanceMetrics ? data.performanceMetrics.avgRating.toFixed(1) : this.calculateAvgRating(data.gigs);
    document.getElementById('avgRating').textContent = avgRating;
  }

  displayAIInsights(data) {
    const container = document.getElementById('aiInsights');
    const grid = document.getElementById('insightsGrid');
    const confidence = document.getElementById('confidenceScore');
    
    if (data.aiInsights && data.aiInsights.length > 0) {
      confidence.textContent = `${data.aiConfidence || 95}%`;
      
      grid.innerHTML = '';
      data.aiInsights.forEach(insight => {
        const insightCard = document.createElement('div');
        insightCard.className = 'insight-card';
        insightCard.innerHTML = `
          <div class="insight-icon">${insight.icon || '💡'}</div>
          <div class="insight-content">
            <h5 class="insight-title">${this.escapeHtml(insight.title)}</h5>
            <p class="insight-description">${this.escapeHtml(insight.description)}</p>
            <div class="insight-meta">
              <span class="insight-confidence">${insight.confidence}% confidence</span>
              <span class="insight-category">${insight.category}</span>
            </div>
          </div>
        `;
        grid.appendChild(insightCard);
      });
      
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  displayCompetitionAnalysis(data) {
    const container = document.getElementById('competitionAnalysis');
    const details = document.getElementById('competitionDetails');
    const score = document.getElementById('competitionScore');
    
    if (data.competition) {
      score.textContent = data.competition.score || 0;
      
      details.innerHTML = `
        <div class="competition-factors">
          <div class="factor-item">
            <span class="factor-label">Total Gigs</span>
            <span class="factor-value">${data.competition.factors.totalGigs}</span>
            <div class="factor-bar">
              <div class="factor-fill" style="width: ${Math.min((data.competition.factors.totalGigs / 1000) * 100, 100)}%"></div>
            </div>
          </div>
          <div class="factor-item">
            <span class="factor-label">Avg Price</span>
            <span class="factor-value">$${data.competition.factors.avgPrice}</span>
            <div class="factor-bar">
              <div class="factor-fill" style="width: ${Math.min((data.competition.factors.avgPrice / 200) * 100, 100)}%"></div>
            </div>
          </div>
          <div class="factor-item">
            <span class="factor-label">Top Rated %</span>
            <span class="factor-value">${data.competition.factors.topRatedPercentage}%</span>
            <div class="factor-bar">
              <div class="factor-fill" style="width: ${data.competition.factors.topRatedPercentage}%"></div>
            </div>
          </div>
        </div>
        <div class="competition-recommendation">
          <h5>Recommendation</h5>
          <p>${this.getCompetitionRecommendation(data.competition.level)}</p>
        </div>
      `;
      
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  displayOpportunityKeywords(data) {
    const container = document.getElementById('opportunityKeywords');
    const grid = document.getElementById('keywordsGrid');
    const count = document.getElementById('opportunityCount');
    
    if (data.opportunityKeywords && data.opportunityKeywords.length > 0) {
      count.textContent = data.opportunityKeywords.length;
      
      grid.innerHTML = '';
      data.opportunityKeywords.forEach(keyword => {
        const keywordCard = document.createElement('div');
        keywordCard.className = 'keyword-card';
        keywordCard.innerHTML = `
          <div class="keyword-content">
            <h5 class="keyword-text">${this.escapeHtml(keyword.text)}</h5>
            <div class="keyword-meta">
              <span class="keyword-competition ${keyword.competition.toLowerCase()}">${keyword.competition}</span>
              <span class="keyword-potential">${keyword.potential}</span>
            </div>
          </div>
          <div class="keyword-actions">
            <button class="keyword-btn" data-keyword="${this.escapeHtml(keyword.text)}">Analyze</button>
          </div>
        `;
        
        keywordCard.querySelector('.keyword-btn').addEventListener('click', (e) => {
          document.getElementById('keywordInput').value = e.target.dataset.keyword;
          this.analyzeKeyword();
        });
        
        grid.appendChild(keywordCard);
      });
      
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  displayEnhancedGigs(gigs) {
    const container = document.getElementById('gigsList');
    container.innerHTML = '';

    gigs.slice(0, 10).forEach(gig => {
      const gigElement = document.createElement('div');
      gigElement.className = 'gig-item enhanced';
      
      gigElement.innerHTML = `
        <div class="gig-header">
          <div class="gig-title-section">
            <h4 class="gig-title">${this.escapeHtml(gig.title)}</h4>
            <div class="gig-meta">
              <span class="seller-level ${gig.sellerLevel.toLowerCase().replace(' ', '-')}">${gig.sellerLevel}</span>
              <span class="gig-rating">⭐ ${gig.rating || 'N/A'}</span>
              <span class="gig-reviews">(${gig.reviews || 0})</span>
            </div>
          </div>
          <div class="gig-price-section">
            <span class="gig-price">$${gig.price || 'N/A'}</span>
            <div class="gig-performance">
              <span class="performance-metric">${gig.impressions || 0} views</span>
              <span class="performance-metric">${gig.orders || 0} orders</span>
            </div>
          </div>
        </div>
        <p class="gig-description">${this.escapeHtml(gig.description)}</p>
        ${gig.tags ? `<div class="gig-tags">${gig.tags.map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        <div class="gig-footer">
          <div class="gig-seller">
            <span class="seller-name">${this.escapeHtml(gig.seller || 'Unknown')}</span>
            <span class="response-time">${gig.responseTime || 'N/A'}</span>
          </div>
          <div class="gig-actions">
            <button class="gig-action-btn" onclick="window.open('https://www.fiverr.com/gig/${gig.id || ''}', '_blank')">View Gig</button>
          </div>
        </div>
      `;
      
      container.appendChild(gigElement);
    });
  }

  createAdvancedCharts(data) {
    this.createSellerLevelsChart(data.gigs);
    this.createPriceAnalysisChart(data.gigs);
  }

  createSellerLevelsChart(gigs) {
    const levels = {
      'New Seller': 0,
      'Level 1': 0,
      'Level 2': 0,
      'Top Rated': 0
    };

    gigs.forEach(gig => {
      if (levels.hasOwnProperty(gig.sellerLevel)) {
        levels[gig.sellerLevel]++;
      }
    });

    const ctx = document.getElementById('sellerLevelsChart').getContext('2d');
    
    if (this.charts.sellerLevels) {
      this.charts.sellerLevels.destroy();
    }

    this.charts.sellerLevels = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(levels),
        datasets: [{
          data: Object.values(levels),
          backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'],
          borderWidth: 2,
          borderColor: '#ffffff',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              fontSize: 10,
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: ${context.parsed} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  createPriceAnalysisChart(gigs) {
    const priceRanges = {
      '$5-25': 0,
      '$26-50': 0,
      '$51-100': 0,
      '$101-200': 0,
      '$200+': 0
    };

    gigs.forEach(gig => {
      const price = parseFloat(gig.price) || 0;
      if (price <= 25) priceRanges['$5-25']++;
      else if (price <= 50) priceRanges['$26-50']++;
      else if (price <= 100) priceRanges['$51-100']++;
      else if (price <= 200) priceRanges['$101-200']++;
      else priceRanges['$200+']++;
    });

    const ctx = document.getElementById('priceChart').getContext('2d');
    
    if (this.charts.price) {
      this.charts.price.destroy();
    }

    this.charts.price = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(priceRanges),
        datasets: [{
          label: 'Number of Gigs',
          data: Object.values(priceRanges),
          backgroundColor: 'rgba(29, 191, 115, 0.8)',
          borderColor: '#1dbf73',
          borderWidth: 2,
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: 'rgba(0,0,0,0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: 'white',
            bodyColor: 'white',
            borderColor: '#1dbf73',
            borderWidth: 1
          }
        }
      }
    });
  }

  async exportAdvancedData() {
    if (!this.currentData) return;

    const keyword = document.getElementById('keywordInput').value;
    const exportData = {
      keyword: keyword,
      timestamp: new Date().toISOString(),
      overview: {
        totalGigs: this.currentData.gigs.length,
        competition: this.currentData.competition,
        avgPrice: this.calculateAvgPrice(this.currentData.gigs),
        avgRating: this.calculateAvgRating(this.currentData.gigs)
      },
      aiInsights: this.currentData.aiInsights || [],
      competitionAnalysis: this.currentData.competition || {},
      opportunityKeywords: this.currentData.opportunityKeywords || [],
      gigs: this.currentData.gigs,
      marketTrends: this.trendingKeywords
    };

    // Create comprehensive CSV
    const csv = this.generateAdvancedCSV(exportData);
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiverr-analysis-${keyword.replace(/\s+/g, '-')}-${Date.now()}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
    
    this.showSuccess('Data exported successfully!', 'Export Complete');
  }

  generateAdvancedCSV(data) {
    const headers = [
      'Keyword', 'Title', 'Price', 'Seller Level', 'Rating', 'Reviews', 
      'Seller', 'Description', 'Tags', 'Impressions', 'Orders', 'Response Time'
    ];
    const rows = [headers.join(',')];

    // Add overview data
    rows.push([
      'OVERVIEW',
      `Total Gigs: ${data.overview.totalGigs}`,
      `Competition: ${data.overview.competition?.level || 'N/A'}`,
      `Avg Price: ${data.overview.avgPrice}`,
      `Avg Rating: ${data.overview.avgRating}`,
      '', '', '', '', '', '', ''
    ].join(','));

    // Add gigs data
    data.gigs.forEach(gig => {
      const row = [
        `"${data.keyword}"`,
        `"${this.escapeCsv(gig.title)}"`,
        `"${gig.price || 'N/A'}"`,
        `"${gig.sellerLevel}"`,
        `"${gig.rating || 'N/A'}"`,
        `"${gig.reviews || 0}"`,
        `"${this.escapeCsv(gig.seller || '')}"`,
        `"${this.escapeCsv(gig.description)}"`,
        `"${gig.tags ? gig.tags.join('; ') : ''}"`,
        `"${gig.impressions || 0}"`,
        `"${gig.orders || 0}"`,
        `"${gig.responseTime || 'N/A'}"`
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  async saveToFavorites() {
    const keyword = document.getElementById('keywordInput').value.trim();
    if (!keyword) return;

    const favorites = await this.getFavorites();
    if (!favorites.find(fav => fav.keyword === keyword)) {
      favorites.push({
        keyword: keyword,
        timestamp: Date.now(),
        data: this.currentData
      });
      await chrome.storage.local.set({ favorites });
      this.loadFavorites();
      this.showSuccess('Keyword saved to favorites!', 'Saved');
    } else {
      this.showError('Keyword already in favorites', 'Duplicate');
    }
  }

  async toggleOverlay() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab.url.includes('fiverr.com')) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleOverlay',
          data: this.currentData
        });
        this.showSuccess('Overlay toggled successfully!', 'Overlay');
      } else {
        this.showError('Navigate to Fiverr.com to use overlay feature', 'Navigation Required');
      }
    } catch (error) {
      console.error('Overlay error:', error);
      this.showError('Failed to toggle overlay', 'Overlay Error');
    }
  }

  async refreshAnalysis() {
    const keyword = document.getElementById('keywordInput').value.trim();
    if (!keyword) {
      this.showError('Please enter a keyword to refresh', 'Input Required');
      return;
    }

    // Clear cache for this keyword
    const cacheKey = `analysis_${keyword}`;
    this.cachedData.delete(cacheKey);

    this.showLoading(true, 'Refreshing analysis...');
    this.hideError();
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeKeyword',
        keyword: keyword,
        forceRefresh: true,
        timestamp: Date.now(),
        includeAIInsights: true,
        includeCompetitionAnalysis: true,
        includeOpportunityKeywords: true
      });

      if (response.error) {
        this.showError(response.error, 'Refresh Failed');
        return;
      }

      this.currentData = response.data;
      this.displayAdvancedResults(response.data, keyword);
      this.updateLastUpdateTime();
      
      this.showSuccess('Analysis refreshed successfully!', 'Refresh Complete');
      
    } catch (error) {
      console.error('Refresh error:', error);
      this.showError('Failed to refresh analysis', 'Refresh Error');
    } finally {
      this.showLoading(false);
    }
  }

  async loadTrendingKeywords() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getTrendingKeywords'
      });

      if (response.trending && response.trending.length > 0) {
        this.trendingKeywords = response.trending;
        this.displayTrendingKeywords(response.trending);
      }
    } catch (error) {
      console.error('Error loading trending keywords:', error);
    }
  }

  displayTrendingKeywords(trending) {
    const container = document.getElementById('trendingKeywords');
    const list = document.getElementById('trendingList');
    
    if (trending.length > 0) {
      list.innerHTML = '';
      
      trending.slice(0, 5).forEach(keyword => {
        const item = document.createElement('div');
        item.className = 'trending-item';
        item.innerHTML = `
          <span class="trending-text">${this.escapeHtml(keyword.text)}</span>
          <span class="trending-score">${keyword.score}</span>
        `;
        
        item.addEventListener('click', () => {
          document.getElementById('keywordInput').value = keyword.text;
          this.analyzeKeyword();
        });
        
        list.appendChild(item);
      });
      
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  }

  startRealTimeUpdates() {
    // Update real-time indicator every 30 seconds
    this.realTimeInterval = setInterval(() => {
      this.updateRealTimeIndicator();
    }, 30000);
  }

  updateRealTimeIndicator() {
    const indicator = document.getElementById('realTimeIndicator');
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');
    
    // Simulate real-time status
    const isLive = Math.random() > 0.1; // 90% chance of being "live"
    
    if (isLive) {
      dot.className = 'status-dot live';
      text.textContent = 'Live';
    } else {
      dot.className = 'status-dot updating';
      text.textContent = 'Updating';
    }
  }

  updateLastUpdateTime() {
    this.lastUpdateTime = new Date();
    const timeString = this.lastUpdateTime.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = timeString;
  }

  // Utility methods
  calculateCompetitionLevel(gigCount) {
    if (gigCount > 1000) return 'Very High';
    if (gigCount > 500) return 'High';
    if (gigCount > 100) return 'Medium';
    if (gigCount > 20) return 'Low';
    return 'Very Low';
  }

  calculateAvgPrice(gigs) {
    const prices = gigs.map(gig => parseFloat(gig.price) || 0).filter(p => p > 0);
    if (prices.length === 0) return '$0';
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return `$${Math.round(avg)}`;
  }

  calculateAvgRating(gigs) {
    const ratings = gigs.map(gig => parseFloat(gig.rating) || 0).filter(r => r > 0);
    if (ratings.length === 0) return '0.0';
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return avg.toFixed(1);
  }

  getCompetitionRecommendation(level) {
    const recommendations = {
      'Very Low': 'Excellent opportunity! Low competition means easy market entry.',
      'Low': 'Good opportunity with manageable competition.',
      'Medium': 'Moderate competition. Focus on unique value proposition.',
      'High': 'High competition. Consider niche specialization.',
      'Very High': 'Very high competition. Look for underserved niches.'
    };
    return recommendations[level] || 'Competition level analysis unavailable.';
  }

  getErrorMessage(error) {
    if (error.message.includes('Extension context invalidated')) {
      return 'Extension needs to be reloaded. Please refresh the page.';
    } else if (error.message.includes('network')) {
      return 'Network error. Please check your internet connection.';
    } else if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    } else {
      return 'An unexpected error occurred. Please try again.';
    }
  }

  // UI State Management
  showLoading(show, message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const status = document.getElementById('loadingStatus');
    
    if (show) {
      status.textContent = message;
      overlay.style.display = 'flex';
    } else {
      overlay.style.display = 'none';
    }
  }

  showError(message, title = 'Error') {
    const container = document.getElementById('errorContainer');
    const titleEl = document.getElementById('errorTitle');
    const messageEl = document.getElementById('errorMessage');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    container.style.display = 'block';
    
    setTimeout(() => {
      container.style.display = 'none';
    }, 5000);
  }

  showSuccess(message, title = 'Success') {
    const container = document.getElementById('successContainer');
    const titleEl = document.getElementById('successTitle');
    const messageEl = document.getElementById('successMessage');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    container.style.display = 'block';
    
    setTimeout(() => {
      container.style.display = 'none';
    }, 3000);
  }

  hideError() {
    document.getElementById('errorContainer').style.display = 'none';
  }

  // Data Management
  async loadUserData() {
    await this.loadFavorites();
    await this.loadHistory();
    await this.loadTrends();
  }

  async loadFavorites() {
    const favorites = await this.getFavorites();
    const container = document.getElementById('favoritesList');
    const section = document.getElementById('favoritesSection');

    if (favorites.length > 0) {
      container.innerHTML = '';
      favorites.forEach(fav => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.innerHTML = `
          <span class="favorite-keyword">${this.escapeHtml(fav.keyword)}</span>
          <div class="favorite-actions">
            <button class="use-favorite" data-keyword="${this.escapeHtml(fav.keyword)}">Use</button>
            <button class="remove-favorite" data-keyword="${this.escapeHtml(fav.keyword)}">×</button>
          </div>
        `;
        container.appendChild(item);
      });

      // Bind favorite events
      container.addEventListener('click', (e) => {
        if (e.target.classList.contains('use-favorite')) {
          document.getElementById('keywordInput').value = e.target.dataset.keyword;
          this.analyzeKeyword();
        } else if (e.target.classList.contains('remove-favorite')) {
          this.removeFavorite(e.target.dataset.keyword);
        }
      });

      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  }

  async loadHistory() {
    const history = await this.getHistory();
    const container = document.getElementById('historyList');
    const section = document.getElementById('historySection');

    if (history.length > 0) {
      container.innerHTML = '';
      history.slice(0, 5).forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
          <span class="history-keyword">${this.escapeHtml(item.keyword)}</span>
          <span class="history-date">${new Date(item.date).toLocaleDateString()}</span>
        `;
        historyItem.addEventListener('click', () => {
          document.getElementById('keywordInput').value = item.keyword;
          this.analyzeKeyword();
        });
        container.appendChild(historyItem);
      });

      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  }

  async loadTrends() {
    // Load market trends data
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getMarketTrends'
      });
      
      if (response.trends) {
        this.displayMarketTrends(response.trends);
      }
    } catch (error) {
      console.error('Error loading trends:', error);
    }
  }

  displayMarketTrends(trends) {
    const container = document.getElementById('trendsSection');
    const list = document.getElementById('trendsList');
    const section = document.getElementById('trendsSection');

    if (trends && trends.length > 0) {
      list.innerHTML = '';
      trends.forEach(trend => {
        const item = document.createElement('div');
        item.className = 'trend-item';
        item.innerHTML = `
          <span class="trend-category">${this.escapeHtml(trend.category)}</span>
          <span class="trend-change ${trend.change > 0 ? 'positive' : 'negative'}">${trend.change > 0 ? '+' : ''}${trend.change}%</span>
        `;
        list.appendChild(item);
      });

      section.style.display = 'block';
    } else {
      section.style.display = 'none';
    }
  }

  async getFavorites() {
    const result = await chrome.storage.local.get(['favorites']);
    return result.favorites || [];
  }

  async getHistory() {
    const result = await chrome.storage.local.get(['searchHistory']);
    return result.searchHistory || [];
  }

  async removeFavorite(keyword) {
    const favorites = await this.getFavorites();
    const updated = favorites.filter(fav => fav.keyword !== keyword);
    await chrome.storage.local.set({ favorites: updated });
    this.loadFavorites();
  }

  async saveToHistory(keyword) {
    const history = await this.getHistory();
    const newItem = { keyword, date: Date.now() };
    
    const filtered = history.filter(item => item.keyword !== keyword);
    filtered.unshift(newItem);
    
    const updated = filtered.slice(0, 10);
    
    await chrome.storage.local.set({ searchHistory: updated });
    this.loadHistory();
  }

  async clearFavorites() {
    await chrome.storage.local.set({ favorites: [] });
    this.loadFavorites();
    this.showSuccess('Favorites cleared', 'Cleared');
  }

  async clearHistory() {
    await chrome.storage.local.set({ searchHistory: [] });
    this.loadHistory();
    this.showSuccess('History cleared', 'Cleared');
  }

  async refreshMarketTrends() {
    this.loadTrends();
    this.showSuccess('Market trends refreshed', 'Refreshed');
  }

  retryLastOperation() {
    this.hideError();
    if (document.getElementById('keywordInput').value) {
      this.analyzeKeyword();
    }
  }

  // Utility functions
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  escapeCsv(text) {
    if (!text) return '';
    return text.replace(/"/g, '""');
  }

  // Chart switching
  switchChartView(chartType) {
    // Update active button
    document.querySelectorAll('.chart-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-chart="${chartType}"]`).classList.add('active');

    // Switch chart data
    if (chartType === 'ratings' && this.currentData) {
      this.createRatingsChart(this.currentData.gigs);
    } else if (chartType === 'revenue' && this.currentData) {
      this.createRevenueChart(this.currentData.gigs);
    }
  }

  createRatingsChart(gigs) {
    const ratingRanges = {
      '4.5-5.0': 0,
      '4.0-4.5': 0,
      '3.5-4.0': 0,
      '3.0-3.5': 0,
      '<3.0': 0
    };

    gigs.forEach(gig => {
      const rating = parseFloat(gig.rating) || 0;
      if (rating >= 4.5) ratingRanges['4.5-5.0']++;
      else if (rating >= 4.0) ratingRanges['4.0-4.5']++;
      else if (rating >= 3.5) ratingRanges['3.5-4.0']++;
      else if (rating >= 3.0) ratingRanges['3.0-3.5']++;
      else ratingRanges['<3.0']++;
    });

    const ctx = document.getElementById('sellerLevelsChart').getContext('2d');
    
    if (this.charts.sellerLevels) {
      this.charts.sellerLevels.destroy();
    }

    this.charts.sellerLevels = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(ratingRanges),
        datasets: [{
          label: 'Number of Gigs',
          data: Object.values(ratingRanges),
          backgroundColor: 'rgba(255, 107, 107, 0.8)',
          borderColor: '#ff6b6b',
          borderWidth: 2,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  createRevenueChart(gigs) {
    const revenueRanges = {
      '$0-100': 0,
      '$101-500': 0,
      '$501-1000': 0,
      '$1001-5000': 0,
      '$5000+': 0
    };

    gigs.forEach(gig => {
      const revenue = (gig.price || 0) * (gig.orders || 0);
      if (revenue <= 100) revenueRanges['$0-100']++;
      else if (revenue <= 500) revenueRanges['$101-500']++;
      else if (revenue <= 1000) revenueRanges['$501-1000']++;
      else if (revenue <= 5000) revenueRanges['$1001-5000']++;
      else revenueRanges['$5000+']++;
    });

    const ctx = document.getElementById('priceChart').getContext('2d');
    
    if (this.charts.price) {
      this.charts.price.destroy();
    }

    this.charts.price = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(revenueRanges),
        datasets: [{
          data: Object.values(revenueRanges),
          backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'],
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              fontSize: 10
            }
          }
        }
      }
    });
  }

  sortGigs(sortBy) {
    if (!this.currentData || !this.currentData.gigs) return;

    let sortedGigs = [...this.currentData.gigs];
    
    switch (sortBy) {
      case 'price':
        sortedGigs.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'rating':
        sortedGigs.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'reviews':
        sortedGigs.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
        break;
      default: // relevance
        // Keep original order
        break;
    }

    this.displayEnhancedGigs(sortedGigs);
  }

  loadMoreGigs() {
    if (!this.currentData || !this.currentData.gigs) return;
    
    // This would typically load more gigs from the server
    // For now, we'll just show a message
    this.showSuccess('Loading more gigs...', 'Loading');
  }

  // Cleanup
  destroy() {
    if (this.realTimeInterval) {
      clearInterval(this.realTimeInterval);
    }
    
    Object.values(this.charts).forEach(chart => {
      if (chart && chart.destroy) {
        chart.destroy();
      }
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.fiverrAnalyzer = new FiverrKeywordInsightAI();
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  if (window.fiverrAnalyzer) {
    window.fiverrAnalyzer.destroy();
  }
});