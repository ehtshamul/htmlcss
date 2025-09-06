// Content.js - Content script for Fiverr pages
class FiverrContentScript {
  constructor() {
    this.overlay = null;
    this.isOverlayVisible = false;
    this.init();
  }

  init() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // Initialize overlay if on search page
    if (this.isSearchPage()) {
      this.setupSearchPageFeatures();
    }
  }

  handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'scrapeGigs':
          const data = this.scrapeCurrentPage(request.keyword);
          sendResponse(data);
          break;
          
        case 'toggleOverlay':
          this.toggleOverlay(request.data);
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({ error: error.message });
    }
  }

  isSearchPage() {
    return window.location.href.includes('/search/gigs') || 
           window.location.href.includes('/categories/');
  }

  setupSearchPageFeatures() {
    // Add CSS for overlay
    this.injectStyles();
    
    // Auto-scrape when page loads
    setTimeout(() => {
      this.autoAnalyzePage();
    }, 2000);
  }

  scrapeCurrentPage(keyword) {
    try {
      const gigs = [];
      
      // Enhanced gig selectors based on current Fiverr structure
      const gigSelectors = [
        '.gig-card-layout',
        '[data-gig-id]',
        '.gig-wrapper',
        '.search-gig-card',
        '.gig-card',
        'article[data-gig-id]',
        '.gig-card-wrapper',
        '.search-result-item',
        '[data-testid="gig-card"]',
        '.gig-item'
      ];
      
      let gigElements = null;
      
      // Find the best selector
      for (const selector of gigSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          gigElements = elements;
          console.log(`Found ${elements.length} gigs using selector: ${selector}`);
          break;
        }
      }

      if (!gigElements || gigElements.length === 0) {
        // Try to find gigs in different ways
        const alternativeSelectors = [
          'a[href*="/gig/"]',
          '[data-gig-id]',
          '.gig-card',
          '.search-gig-card'
        ];
        
        for (const selector of alternativeSelectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            gigElements = elements;
            console.log(`Found ${elements.length} gigs using alternative selector: ${selector}`);
            break;
          }
        }
      }

      if (!gigElements || gigElements.length === 0) {
        return { 
          gigs: [], 
          error: 'No gigs found on current page',
          pageInfo: {
            url: window.location.href,
            title: document.title,
            hasSearchResults: document.querySelector('.search-results, .gigs-container, .search-gigs') !== null
          }
        };
      }

      gigElements.forEach((element, index) => {
        if (index >= 30) return; // Increased limit for better data
        
        const gig = this.extractGigFromElement(element);
        if (gig.title) {
          gigs.push(gig);
        }
      });

      // Enhance data with additional analysis
      const enhancedData = {
        keyword: keyword || this.extractCurrentKeyword(),
        gigs: gigs,
        totalResults: gigs.length,
        scrapedAt: new Date().toISOString(),
        url: window.location.href,
        pageInfo: {
          title: document.title,
          hasPagination: document.querySelector('.pagination, .pager') !== null,
          searchFilters: this.extractSearchFilters()
        }
      };

      // Add competition analysis
      if (gigs.length > 0) {
        enhancedData.competition = this.analyzeCompetition(gigs);
        enhancedData.marketInsights = this.generateMarketInsights(gigs, enhancedData.keyword);
        enhancedData.lowCompetitionKeywords = this.findLowCompetitionKeywords(enhancedData.keyword, gigs);
      }

      return enhancedData;

    } catch (error) {
      console.error('Scraping error:', error);
      return { 
        gigs: [], 
        error: error.message,
        pageInfo: {
          url: window.location.href,
          title: document.title
        }
      };
    }
  }

  extractGigFromElement(element) {
    const gig = {
      title: '',
      description: '',
      price: null,
      sellerLevel: 'New Seller',
      rating: null,
      reviews: 0,
      tags: [],
      seller: '',
      imageUrl: ''
    };

    try {
      // Title extraction with multiple fallbacks
      const titleSelectors = [
        'h3[data-testid="gig-title"] a',
        '.gig-title a',
        'h3 a',
        'a[data-gig-id] h3',
        '.gig-card-title',
        '[data-testid="gig-title"]'
      ];

      for (const selector of titleSelectors) {
        const titleEl = element.querySelector(selector);
        if (titleEl && titleEl.textContent.trim()) {
          gig.title = titleEl.textContent.trim();
          break;
        }
      }

      // Description extraction
      const descSelectors = [
        '.gig-card-description p',
        'p[data-testid="gig-description"]',
        '.gig-description',
        'p.description'
      ];

      for (const selector of descSelectors) {
        const descEl = element.querySelector(selector);
        if (descEl && descEl.textContent.trim()) {
          gig.description = descEl.textContent.trim().substring(0, 200);
          break;
        }
      }

      // Price extraction with enhanced patterns
      const priceSelectors = [
        '.price-wrapper .price',
        '[data-testid="price"]',
        '.gig-price',
        '.price-display',
        '.starting-price'
      ];

      for (const selector of priceSelectors) {
        const priceEl = element.querySelector(selector);
        if (priceEl) {
          const priceText = priceEl.textContent.trim();
          // Match various price formats: $5, From $15, Starting at $25, etc.
          const priceMatch = priceText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
          if (priceMatch) {
            gig.price = parseInt(priceMatch[1].replace(',', ''));
            break;
          }
        }
      }

      // Seller level extraction
      const levelSelectors = [
        '.seller-level-badge',
        '.level-badge',
        '[data-testid="seller-level"]',
        '.badge-level'
      ];

      for (const selector of levelSelectors) {
        const levelEl = element.querySelector(selector);
        if (levelEl) {
          const levelText = levelEl.textContent.trim().toLowerCase();
          if (levelText.includes('top rated') || levelText.includes('pro')) {
            gig.sellerLevel = 'Top Rated';
          } else if (levelText.includes('level 2') || levelText.includes('lv2')) {
            gig.sellerLevel = 'Level 2';
          } else if (levelText.includes('level 1') || levelText.includes('lv1')) {
            gig.sellerLevel = 'Level 1';
          }
          break;
        }
      }

      // Rating extraction
      const ratingSelectors = [
        '.rating-score',
        '[data-testid="rating"]',
        '.star-rating-score',
        '.gig-rating .score'
      ];

      for (const selector of ratingSelectors) {
        const ratingEl = element.querySelector(selector);
        if (ratingEl) {
          const ratingText = ratingEl.textContent.trim();
          const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
          if (ratingMatch && parseFloat(ratingMatch[1]) <= 5) {
            gig.rating = parseFloat(ratingMatch[1]);
            break;
          }
        }
      }

      // Reviews count
      const reviewSelectors = [
        '.rating-count',
        '[data-testid="review-count"]',
        '.reviews-count'
      ];

      for (const selector of reviewSelectors) {
        const reviewEl = element.querySelector(selector);
        if (reviewEl) {
          const reviewText = reviewEl.textContent.trim();
          const reviewMatch = reviewText.match(/\((\d+(?:,\d{3})*)\)/);
          if (reviewMatch) {
            gig.reviews = parseInt(reviewMatch[1].replace(',', ''));
            break;
          }
        }
      }

      // Seller name
      const sellerSelectors = [
        '.seller-name',
        '[data-testid="seller-name"]',
        '.seller-info .name'
      ];

      for (const selector of sellerSelectors) {
        const sellerEl = element.querySelector(selector);
        if (sellerEl && sellerEl.textContent.trim()) {
          gig.seller = sellerEl.textContent.trim();
          break;
        }
      }

      // Image URL
      const imageSelectors = [
        '.gig-media img',
        '.gig-image img',
        'img[data-testid="gig-image"]'
      ];

      for (const selector of imageSelectors) {
        const imgEl = element.querySelector(selector);
        if (imgEl && imgEl.src) {
          gig.imageUrl = imgEl.src;
          break;
        }
      }

      // Tags/Categories
      const tagSelectors = [
        '.gig-tags .tag',
        '.tag-list .tag',
        '[data-testid="tag"]'
      ];

      for (const selector of tagSelectors) {
        const tagEls = element.querySelectorAll(selector);
        if (tagEls.length > 0) {
          gig.tags = Array.from(tagEls)
            .map(tag => tag.textContent.trim())
            .filter(tag => tag.length > 0)
            .slice(0, 5);
          break;
        }
      }

    } catch (error) {
      console.error('Element extraction error:', error);
    }

    return gig;
  }

  extractCurrentKeyword() {
    // Try to extract keyword from URL or page
    const urlParams = new URLSearchParams(window.location.search);
    const keyword = urlParams.get('query') || urlParams.get('q');
    
    if (keyword) return keyword;

    // Try from page title or search input
    const searchInput = document.querySelector('input[name="query"], input[data-testid="search-input"]');
    if (searchInput && searchInput.value) {
      return searchInput.value;
    }

    // Try from page heading
    const headings = document.querySelectorAll('h1, h2, .page-title');
    for (const heading of headings) {
      if (heading.textContent.includes('Results for')) {
        const match = heading.textContent.match(/Results for (.+)/);
        if (match) return match[1].replace(/"/g, '');
      }
    }

    return 'unknown';
  }

  toggleOverlay(data) {
    if (this.isOverlayVisible) {
      this.hideOverlay();
    } else {
      this.showOverlay(data);
    }
  }

  showOverlay(data) {
    if (this.overlay) {
      this.overlay.remove();
    }

    this.overlay = this.createOverlay(data);
    document.body.appendChild(this.overlay);
    this.isOverlayVisible = true;

    // Animate in
    setTimeout(() => {
      this.overlay.classList.add('fiverr-overlay-visible');
    }, 10);
  }

  hideOverlay() {
    if (this.overlay) {
      this.overlay.classList.remove('fiverr-overlay-visible');
      setTimeout(() => {
        if (this.overlay) {
          this.overlay.remove();
          this.overlay = null;
        }
      }, 300);
    }
    this.isOverlayVisible = false;
  }

  createOverlay(data) {
    const overlay = document.createElement('div');
    overlay.className = 'fiverr-analyzer-overlay';
    overlay.id = 'fiverrAnalyzerOverlay';

    const stats = this.calculateStats(data?.gigs || []);

    overlay.innerHTML = `
      <div class="overlay-header">
        <h3>📊 Fiverr Analysis</h3>
        <button class="overlay-close" id="overlayCloseBtn">×</button>
      </div>
      
      <div class="overlay-content">
        <div class="overlay-stats">
          <div class="stat-item">
            <span class="stat-value">${stats.totalGigs}</span>
            <span class="stat-label">Gigs Found</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${stats.competition}</span>
            <span class="stat-label">Competition</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">$${stats.avgPrice}</span>
            <span class="stat-label">Avg Price</span>
          </div>
        </div>
        
        <div class="overlay-levels">
          <h4>Seller Level Distribution</h4>
          <div class="level-bars">
            ${Object.entries(stats.levels).map(([level, count]) => `
              <div class="level-bar">
                <span class="level-name">${level}</span>
                <div class="level-progress">
                  <div class="level-fill" style="width: ${(count / stats.totalGigs) * 100}%"></div>
                </div>
                <span class="level-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="overlay-actions">
          <button class="overlay-btn" id="refreshAnalysis">🔄 Refresh</button>
          <button class="overlay-btn" id="exportOverlayData">📥 Export</button>
        </div>
      </div>
    `;

    // Bind overlay events
    overlay.querySelector('#overlayCloseBtn').addEventListener('click', () => {
      this.hideOverlay();
    });

    overlay.querySelector('#refreshAnalysis').addEventListener('click', () => {
      const keyword = this.extractCurrentKeyword();
      const newData = this.scrapeCurrentPage(keyword);
      this.updateOverlayContent(overlay, newData);
    });

    overlay.querySelector('#exportOverlayData').addEventListener('click', () => {
      this.exportOverlayData(data);
    });

    return overlay;
  }

  calculateStats(gigs) {
    const stats = {
      totalGigs: gigs.length,
      competition: gigs.length > 1000 ? 'High' : gigs.length > 500 ? 'Medium' : 'Low',
      avgPrice: 0,
      levels: {
        'New Seller': 0,
        'Level 1': 0,
        'Level 2': 0,
        'Top Rated': 0
      }
    };

    if (gigs.length > 0) {
      const prices = gigs.map(gig => gig.price || 0).filter(p => p > 0);
      if (prices.length > 0) {
        stats.avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
      }

      gigs.forEach(gig => {
        if (stats.levels.hasOwnProperty(gig.sellerLevel)) {
          stats.levels[gig.sellerLevel]++;
        }
      });
    }

    return stats;
  }

  updateOverlayContent(overlay, newData) {
    const stats = this.calculateStats(newData.gigs || []);
    
    // Update stats
    const statItems = overlay.querySelectorAll('.stat-value');
    statItems[0].textContent = stats.totalGigs;
    statItems[1].textContent = stats.competition;
    statItems[2].textContent = `$${stats.avgPrice}`;

    // Update level bars
    const levelBars = overlay.querySelectorAll('.level-bar');
    levelBars.forEach((bar, index) => {
      const levels = Object.entries(stats.levels);
      if (levels[index]) {
        const [level, count] = levels[index];
        const fill = bar.querySelector('.level-fill');
        const countSpan = bar.querySelector('.level-count');
        
        fill.style.width = `${(count / stats.totalGigs) * 100}%`;
        countSpan.textContent = count;
      }
    });
  }

  exportOverlayData(data) {
    if (!data || !data.gigs) return;

    const keyword = data.keyword || this.extractCurrentKeyword();
    const csv = this.generateCSV(data.gigs, keyword);
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiverr-overlay-${keyword.replace(/\s+/g, '-')}-${Date.now()}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  generateCSV(gigs, keyword) {
    const headers = ['Keyword', 'Title', 'Price', 'Seller Level', 'Rating', 'Reviews', 'Seller', 'Description'];
    const rows = [headers.join(',')];

    gigs.forEach(gig => {
      const row = [
        `"${keyword}"`,
        `"${this.escapeCsv(gig.title)}"`,
        `"${gig.price || 'N/A'}"`,
        `"${gig.sellerLevel}"`,
        `"${gig.rating || 'N/A'}"`,
        `"${gig.reviews || 0}"`,
        `"${this.escapeCsv(gig.seller)}"`,
        `"${this.escapeCsv(gig.description)}"`
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  escapeCsv(text) {
    if (!text) return '';
    return text.replace(/"/g, '""');
  }

  autoAnalyzePage() {
    // Automatically show overlay with current page data
    const keyword = this.extractCurrentKeyword();
    const data = this.scrapeCurrentPage(keyword);
    
    if (data.gigs.length > 0) {
      // Show small notification that analysis is available
      this.showAnalysisNotification(data);
    }
  }

  showAnalysisNotification(data) {
    const notification = document.createElement('div');
    notification.className = 'fiverr-analysis-notification';
    notification.innerHTML = `
      <div class="notification-content">
        📊 Found ${data.gigs.length} gigs to analyze
        <button class="notification-btn" id="showAnalysisBtn">View Analysis</button>
        <button class="notification-close" id="notificationCloseBtn">×</button>
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-hide after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 10000);

    // Bind events
    notification.querySelector('#showAnalysisBtn').addEventListener('click', () => {
      this.showOverlay(data);
      notification.remove();
    });

    notification.querySelector('#notificationCloseBtn').addEventListener('click', () => {
      notification.remove();
    });
  }

  extractSearchFilters() {
    const filters = {};
    
    // Extract active filters from the page
    const activeFilters = document.querySelectorAll('.filter-active, .selected-filter, [data-filter-active="true"]');
    activeFilters.forEach(filter => {
      const filterText = filter.textContent.trim();
      if (filterText) {
        filters[filterText] = true;
      }
    });
    
    return filters;
  }

  analyzeCompetition(gigs) {
    const totalGigs = gigs.length;
    const prices = gigs.map(g => g.price).filter(p => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    
    const sellerLevels = {
      'New Seller': 0,
      'Level 1': 0,
      'Level 2': 0,
      'Top Rated': 0
    };
    
    gigs.forEach(gig => {
      if (sellerLevels.hasOwnProperty(gig.sellerLevel)) {
        sellerLevels[gig.sellerLevel]++;
      }
    });
    
    const topRatedPercentage = (sellerLevels['Top Rated'] / totalGigs) * 100;
    
    let competitionLevel = 'Low';
    let competitionScore = 0;
    
    // Competition scoring
    if (totalGigs > 100) competitionScore += 30;
    else if (totalGigs > 50) competitionScore += 20;
    else if (totalGigs > 20) competitionScore += 10;
    
    if (avgPrice < 20) competitionScore += 25;
    else if (avgPrice < 50) competitionScore += 15;
    else if (avgPrice < 100) competitionScore += 10;
    
    if (topRatedPercentage > 30) competitionScore += 20;
    else if (topRatedPercentage > 15) competitionScore += 15;
    else if (topRatedPercentage > 5) competitionScore += 10;
    
    if (competitionScore >= 50) competitionLevel = 'High';
    else if (competitionScore >= 30) competitionLevel = 'Medium';
    else if (competitionScore >= 15) competitionLevel = 'Low';
    else competitionLevel = 'Very Low';
    
    return {
      level: competitionLevel,
      score: competitionScore,
      factors: {
        totalGigs,
        avgPrice: Math.round(avgPrice),
        topRatedPercentage: Math.round(topRatedPercentage)
      }
    };
  }

  generateMarketInsights(gigs, keyword) {
    const insights = [];
    
    if (gigs.length === 0) {
      insights.push("No existing gigs found - this could be a blue ocean opportunity!");
      return insights;
    }

    const prices = gigs.map(g => g.price).filter(p => p > 0);
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    
    const ratings = gigs.map(g => g.rating).filter(r => r > 0);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

    // Price insights
    if (avgPrice < 20) {
      insights.push("Low average price suggests high competition or commoditized market");
    } else if (avgPrice > 100) {
      insights.push("High average price indicates premium market with potential for quality differentiation");
    }

    // Rating insights
    if (avgRating < 4.0) {
      insights.push("Low average ratings suggest market opportunity for quality improvement");
    } else if (avgRating > 4.7) {
      insights.push("High average ratings indicate quality expectations are high");
    }

    // Competition insights
    const topRatedCount = gigs.filter(g => g.sellerLevel === 'Top Rated').length;
    if (topRatedCount === 0) {
      insights.push("No Top Rated sellers found - opportunity to become the first!");
    } else if (topRatedCount / gigs.length > 0.3) {
      insights.push("High concentration of Top Rated sellers - focus on unique value proposition");
    }

    return insights;
  }

  findLowCompetitionKeywords(baseKeyword, gigs) {
    const suggestions = [];
    const baseLower = baseKeyword.toLowerCase();
    
    // Generate variations with different modifiers
    const modifiers = [
      'custom', 'unique', 'premium', 'professional', 'creative', 'modern',
      'vintage', 'minimalist', 'luxury', 'budget', 'fast', 'quick',
      'detailed', 'simple', 'complex', 'advanced', 'beginner', 'expert'
    ];

    const services = [
      'design', 'service', 'solution', 'package', 'bundle', 'template',
      'kit', 'tool', 'guide', 'tutorial', 'course', 'consultation'
    ];

    // Generate keyword variations
    modifiers.forEach(modifier => {
      if (!baseLower.includes(modifier)) {
        suggestions.push(`${modifier} ${baseKeyword}`);
        suggestions.push(`${baseKeyword} ${modifier}`);
      }
    });

    services.forEach(service => {
      if (!baseLower.includes(service)) {
        suggestions.push(`${baseKeyword} ${service}`);
      }
    });

    // Add long-tail variations
    const longTailVariations = [
      `${baseKeyword} for business`,
      `${baseKeyword} for beginners`,
      `${baseKeyword} for professionals`,
      `affordable ${baseKeyword}`,
      `cheap ${baseKeyword}`,
      `premium ${baseKeyword}`,
      `${baseKeyword} template`,
      `${baseKeyword} package`
    ];

    suggestions.push(...longTailVariations);

    return suggestions.slice(0, 10);
  }

  injectStyles() {
    if (document.getElementById('fiverrAnalyzerStyles')) return;

    const style = document.createElement('style');
    style.id = 'fiverrAnalyzerStyles';
    style.textContent = `
      .fiverr-analyzer-overlay {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        max-height: 600px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      }
      
      .fiverr-overlay-visible {
        transform: translateX(0);
      }
      
      .overlay-header {
        background: linear-gradient(135deg, #1dbf73, #00a085);
        color: white;
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .overlay-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      
      .overlay-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .overlay-close:hover {
        background: rgba(255,255,255,0.2);
      }
      
      .overlay-content {
        padding: 20px;
        max-height: 520px;
        overflow-y: auto;
      }
      
      .overlay-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        margin-bottom: 20px;
      }
      
      .stat-item {
        text-align: center;
        padding: 10px;
        border-radius: 8px;
        background: #f8f9fa;
      }
      
      .stat-value {
        display: block;
        font-size: 20px;
        font-weight: 700;
        color: #1dbf73;
      }
      
      .stat-label {
        font-size: 12px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .overlay-levels h4 {
        margin: 0 0 15px 0;
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }
      
      .level-bar {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        font-size: 12px;
      }
      
      .level-name {
        width: 80px;
        flex-shrink: 0;
        color: #666;
      }
      
      .level-progress {
        flex: 1;
        height: 8px;
        background: #e9ecef;
        border-radius: 4px;
        margin: 0 10px;
        overflow: hidden;
      }
      
      .level-fill {
        height: 100%;
        background: linear-gradient(90deg, #1dbf73, #00a085);
        transition: width 0.3s ease;
      }
      
      .level-count {
        width: 30px;
        text-align: right;
        font-weight: 600;
        color: #333;
      }
      
      .overlay-actions {
        margin-top: 20px;
        display: flex;
        gap: 10px;
      }
      
      .overlay-btn {
        flex: 1;
        padding: 8px 12px;
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
      }
      
      .overlay-btn:hover {
        background: #e9ecef;
        border-color: #adb5bd;
      }
      
      .fiverr-analysis-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1dbf73;
        color: white;
        border-radius: 8px;
        padding: 15px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideInUp 0.3s ease;
      }
      
      .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .notification-btn {
        background: white;
        color: #1dbf73;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
      }
      
      .notification-btn:hover {
        background: #f8f9fa;
      }
      
      .notification-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
        margin-left: auto;
      }
      
      @keyframes slideInUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;

    document.head.appendChild(style);
  }
}

// Initialize content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new FiverrContentScript());
} else {
  new FiverrContentScript();
}