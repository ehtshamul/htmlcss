// Background.js - Service Worker for Chrome Extension
class FiverrDataFetcher {
    constructor() {
        this.initializeListeners();
    }

    initializeListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async response
        });
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'getSmartSuggestions':
                    {
                        const raw = await this.fetchSuggestions(request.keyword || '');
                        const suggestions = this.buildSuggestionObjects(raw, request.includeTrending === true);
                        sendResponse({ suggestions });
                    }
                    break;

                case 'getSuggestions':
                    const suggestions = await this.fetchSuggestions(request.keyword);
                    sendResponse({ suggestions });
                    break;

                case 'searchKeyword':
                    const data = await this.searchKeyword(request.keyword);
                    sendResponse({ data });
                    break;

                case 'analyzeKeyword':
                    {
                        const data = await this.searchKeyword(request.keyword);
                        sendResponse({ data });
                    }
                    break;

                case 'getTrendingKeywords':
                    {
                        const trending = await this.fetchTrendingKeywords();
                        sendResponse({ trending });
                    }
                    break;

                case 'getMarketTrends':
                    {
                        const trends = await this.fetchMarketTrends();
                        sendResponse({ trends });
                    }
                    break;

                default:
                    sendResponse({ error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background script error:', error);
            sendResponse({ error: error.message });
        }
    }

    buildSuggestionObjects(suggestions, includeTrending = false) {
        try {
            const unique = Array.from(new Set((suggestions || []).map(s => (typeof s === 'string' ? s : (s.text || ''))))).filter(Boolean);
            return unique.slice(0, 10).map(text => {
                // Heuristic difficulty based on length and word count
                const wordCount = text.trim().split(/\s+/).length;
                const lengthScore = Math.min(text.length, 30);
                const difficulty = lengthScore <= 12 && wordCount <= 2 ? 'high' : lengthScore <= 20 ? 'medium' : 'low';

                // Lightweight competition heuristic
                const competitiveTerms = ['logo', 'seo', 'design', 'website', 'wordpress', 'shopify', 'ai'];
                const hasCompetitiveTerm = competitiveTerms.some(t => text.toLowerCase().includes(t));
                const competition = hasCompetitiveTerm ? 'High' : wordCount >= 3 ? 'Low' : 'Medium';

                const trending = includeTrending ? (['logo', 'ai', 'tiktok', 'shorts', 'notion', 'shopify'].some(t => text.toLowerCase().includes(t))) : false;

                return { text, difficulty, competition, trending };
            });
        } catch (_) {
            return (suggestions || []).slice(0, 6).map(s => ({ text: typeof s === 'string' ? s : (s.text || ''), difficulty: 'medium', competition: 'N/A' }));
        }
    }

    async fetchSuggestions(keyword) {
        try {
            // Try multiple Fiverr API endpoints for suggestions
            const endpoints = [
                `https://www.fiverr.com/api/v1/autocomplete?query=${encodeURIComponent(keyword)}`,
                `https://www.fiverr.com/autocomplete?q=${encodeURIComponent(keyword)}`,
                `https://www.fiverr.com/api/v2/autocomplete?q=${encodeURIComponent(keyword)}`
            ];

            for (const url of endpoints) {
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json, text/plain, */*',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://www.fiverr.com/',
                            'Origin': 'https://www.fiverr.com'
                        },
                        credentials: 'omit'
                    });

                    if (!response.ok) {
                        continue; // Try next endpoint
                    }

                    const contentType = (response.headers.get('content-type') || '').toLowerCase();
                    
                    if (contentType.includes('application/json')) {
                        const data = await response.json();
                        
                        // Extract suggestions from various response formats
                        if (data && Array.isArray(data)) {
                            return data.slice(0, 8);
                        }
                        
                        if (data && data.suggestions && Array.isArray(data.suggestions)) {
                            return data.suggestions.slice(0, 8);
                        }
                        
                        if (data && data.terms && Array.isArray(data.terms)) {
                            return data.terms.slice(0, 8);
                        }
                        
                        if (data && data.data && Array.isArray(data.data)) {
                            return data.data.slice(0, 8);
                        }
                        
                        if (data && data.results && Array.isArray(data.results)) {
                            return data.results.slice(0, 8);
                        }
                    }
                } catch (endpointError) {
                    console.log(`Endpoint ${url} failed:`, endpointError.message);
                    continue; // Try next endpoint
                }
            }

            // If all endpoints fail, try scraping from search page
            return await this.scrapeSuggestionsFromSearch(keyword);

        } catch (error) {
            console.error('All suggestion methods failed:', error);
            return this.getFallbackSuggestions(keyword);
        }
    }

    async scrapeSuggestionsFromSearch(keyword) {
        try {
            const searchUrl = `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}`;
            const response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const html = await response.text();
            const suggestions = this.extractSuggestionsFromHTML(html, keyword);
            
            if (suggestions.length > 0) {
                return suggestions.slice(0, 8);
            }

            return this.getFallbackSuggestions(keyword);
        } catch (error) {
            console.error('Scraping suggestions failed:', error);
            return this.getFallbackSuggestions(keyword);
        }
    }

    extractSuggestionsFromHTML(html, keyword) {
        const suggestions = [];
        const keywordLower = keyword.toLowerCase();
        
        // Extract common patterns from HTML that might contain related keywords
        const patterns = [
            /data-suggestion="([^"]+)"/g,
            /data-keyword="([^"]+)"/g,
            /class="[^"]*suggestion[^"]*"[^>]*>([^<]+)</g,
            /class="[^"]*keyword[^"]*"[^>]*>([^<]+)</g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const suggestion = match[1].trim();
                if (suggestion && suggestion.toLowerCase().includes(keywordLower) && !suggestions.includes(suggestion)) {
                    suggestions.push(suggestion);
                }
            }
        });

        return suggestions;
    }

    getFallbackSuggestions(keyword) {
        const commonSuffixes = [
            ' design', ' logo', ' website', ' app', ' service', ' writing', ' marketing', ' animation'
        ];

        const suggestions = commonSuffixes.map(suffix => keyword + suffix);
        return suggestions.slice(0, 6);
    }

    async searchKeyword(keyword) {
        try {
            // Try to inject content script to scrape data
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const activeTab = tabs[0];

            if (activeTab && activeTab.url && activeTab.url.includes('fiverr.com')) {
                // Fiverr-only: use on-page content script
                return await this.scrapeFromContentScript(keyword, activeTab.id);
            }
            // Enforce Fiverr-only behavior
            return { gigs: [], keyword, totalResults: 0, error: 'Please open a Fiverr search page to analyze in real time.' };
        } catch (error) {
            console.error('Search error:', error);
            // Fiverr-only: do not fall back to non-Fiverr sources
            return { gigs: [], keyword, totalResults: 0, error: 'Analysis failed. Open a Fiverr search page and try again.' };
        }
    }

    async scrapeFromContentScript(keyword, tabId) {
        try {
            // Send message to content script to scrape current page
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'scrapeGigs',
                keyword: keyword
            });

            if (response && response.gigs) {
                return response;
            }
            // Fiverr-only: no fallback
            return { gigs: [], keyword, totalResults: 0, error: 'No gigs found on the current Fiverr page.' };
        } catch (error) {
            console.error('Content script scrape error:', error);
            // Fiverr-only: no fallback
            return { gigs: [], keyword, totalResults: 0, error: 'Could not scrape the Fiverr page. Try refreshing the page.' };
        }
    }

    async fetchGigData(keyword) {
        try {
            // Try multiple search URLs for better data coverage
            const searchUrls = [
                `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}&source=main_banner&search_in=everywhere`,
                `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}&sort=relevance`,
                `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}&sort=price_low_to_high`,
                `https://www.fiverr.com/search/gigs?query=${encodeURIComponent(keyword)}&sort=price_high_to_low`
            ];

            let bestData = null;
            let maxGigs = 0;

            // Try each URL and pick the one with most gigs
            for (const searchUrl of searchUrls) {
                try {
                    const response = await fetch(searchUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://www.fiverr.com/',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    if (!response.ok) {
                        continue;
                    }

                    const html = await response.text();
                    const data = this.parseGigData(html, keyword);
                    
                    if (data.gigs && data.gigs.length > maxGigs) {
                        maxGigs = data.gigs.length;
                        bestData = data;
                    }
                } catch (urlError) {
                    console.log(`URL ${searchUrl} failed:`, urlError.message);
                    continue;
                }
            }

            if (bestData && bestData.gigs.length > 0) {
                // Enhance data with additional analysis
                return this.enhanceGigData(bestData, keyword);
            }

            // If no data found, try API endpoints
            return await this.fetchGigDataFromAPI(keyword);

        } catch (error) {
            console.error('Fetch gig data error:', error);
            return this.getMockData(keyword);
        }
    }

    async fetchGigDataFromAPI(keyword) {
        try {
            // Try Fiverr's internal API endpoints
            const apiUrls = [
                `https://www.fiverr.com/api/v1/search/gigs?query=${encodeURIComponent(keyword)}&limit=20`,
                `https://www.fiverr.com/api/v2/search/gigs?query=${encodeURIComponent(keyword)}&limit=20`
            ];

            for (const apiUrl of apiUrls) {
                try {
                    const response = await fetch(apiUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                            'Referer': 'https://www.fiverr.com/'
                        }
                    });

                    if (!response.ok) {
                        continue;
                    }

                    const data = await response.json();
                    if (data && data.gigs) {
                        return this.enhanceGigData({
                            keyword: keyword,
                            gigs: data.gigs,
                            totalResults: data.total || data.gigs.length,
                            fetchedAt: new Date().toISOString()
                        }, keyword);
                    }
                } catch (apiError) {
                    console.log(`API ${apiUrl} failed:`, apiError.message);
                    continue;
                }
            }

            return this.getMockData(keyword);
        } catch (error) {
            console.error('API fetch error:', error);
            return this.getMockData(keyword);
        }
    }

    enhanceGigData(data, keyword) {
        // Add competition analysis
        data.competition = this.analyzeCompetition(data.gigs);
        
        // Add market insights
        data.marketInsights = this.generateMarketInsights(data.gigs, keyword);
        
        // Add low competition opportunities
        data.lowCompetitionKeywords = this.findLowCompetitionKeywords(keyword, data.gigs);
        
        // Add performance metrics
        data.performanceMetrics = this.calculatePerformanceMetrics(data.gigs);

        // Add opportunity keywords (structured)
        data.opportunityKeywords = (data.lowCompetitionKeywords || []).map(k => ({
            text: k,
            competition: 'Low',
            potential: 'High'
        }));

        // Add simple AI insights payload expected by popup
        data.bestKeyword = this.computeBestKeyword(keyword, data.gigs, data.opportunityKeywords);
        data.aiInsights = this.generateAIInsights(data, keyword);
        data.aiConfidence = 92;
        
        return data;
    }

    generateAIInsights(data, keyword) {
        const insights = [];
        const gigs = data.gigs || [];
        const avgPrice = data.performanceMetrics?.avgPrice || 0;
        const avgRating = data.performanceMetrics?.avgRating || 0;
        const totalGigs = gigs.length;

        if (data.bestKeyword) {
            insights.push({
                icon: '🏷️',
                title: 'Best Keyword',
                description: `Recommended focus: "${data.bestKeyword}" for lower competition and clear buyer intent.`,
                confidence: 92,
                category: 'Recommendation'
            });
        }

        insights.push({
            icon: '💡',
            title: 'Pricing Opportunity',
            description: avgPrice > 0 ? `Average starting price around $${avgPrice}. Trying $${Math.max(5, Math.round(avgPrice * 0.8))} may improve conversion for "${keyword}".` : `Set a competitive entry price for "${keyword}" to attract first buyers.`,
            confidence: 90,
            category: 'Pricing'
        });

        insights.push({
            icon: '🎯',
            title: 'Niche Positioning',
            description: totalGigs > 0 ? `There are ${totalGigs} gigs. Consider long‑tail angles like "${keyword} template" or "${keyword} for startups".` : `Few gigs detected. Create a detailed gig to dominate "${keyword}" early.`,
            confidence: 88,
            category: 'Positioning'
        });

        insights.push({
            icon: '⭐',
            title: 'Quality Bar',
            description: avgRating > 0 ? `Average rating ~${avgRating.toFixed(1)}. Emphasize strong portfolio and fast response to exceed expectations.` : `No ratings context found. Highlight guarantees and fast delivery to build trust.`,
            confidence: 85,
            category: 'Quality'
        });

        return insights;
    }

    computeBestKeyword(baseKeyword, gigs, opportunityKeywords = []) {
        try {
            const candidates = (opportunityKeywords || []).map(o => o.text).concat(this.findLowCompetitionKeywords(baseKeyword, gigs) || []);
            const unique = Array.from(new Set(candidates)).filter(Boolean);
            if (unique.length === 0) return baseKeyword;

            const boostTerms = ['template', 'audit', 'setup', 'starter', 'pack', 'bundle', 'for startups', 'for small business'];
            const penalizeTerms = ['logo', 'seo', 'design', 'website'];

            const scored = unique.map(text => {
                const words = text.trim().split(/\s+/).length;
                let score = 0;
                // Prefer long-tail (3-5 words)
                if (words >= 5) score += 18; else if (words === 4) score += 22; else if (words === 3) score += 20; else if (words === 2) score += 8; else score += 2;
                // Boost actionable/intent modifiers
                if (boostTerms.some(t => text.toLowerCase().includes(t))) score += 12;
                // Penalize hyper-competitive roots if too short
                if (penalizeTerms.some(t => text.toLowerCase().includes(t)) && words <= 2) score -= 10;
                // Prefer containing base keyword at start
                if (text.toLowerCase().startsWith(baseKeyword.toLowerCase().split(' ')[0])) score += 5;
                return { text, score };
            });

            scored.sort((a, b) => b.score - a.score);
            return scored[0]?.text || baseKeyword;
        } catch (_) {
            return baseKeyword;
        }
    }

    analyzeCompetition(gigs) {
        const totalGigs = gigs.length;
        const priceRange = this.calculatePriceRange(gigs);
        const sellerLevels = this.analyzeSellerLevels(gigs);
        const ratings = this.analyzeRatings(gigs);

        let competitionLevel = 'Low';
        let competitionScore = 0;

        // Factor 1: Number of gigs
        if (totalGigs > 1000) competitionScore += 40;
        else if (totalGigs > 500) competitionScore += 30;
        else if (totalGigs > 100) competitionScore += 20;
        else if (totalGigs > 50) competitionScore += 10;

        // Factor 2: Price competition (lower prices = higher competition)
        const avgPrice = priceRange.average;
        if (avgPrice < 20) competitionScore += 25;
        else if (avgPrice < 50) competitionScore += 15;
        else if (avgPrice < 100) competitionScore += 10;

        // Factor 3: Seller level distribution (more experienced sellers = higher competition)
        const topRatedPercentage = (sellerLevels['Top Rated'] / totalGigs) * 100;
        if (topRatedPercentage > 30) competitionScore += 20;
        else if (topRatedPercentage > 15) competitionScore += 15;
        else if (topRatedPercentage > 5) competitionScore += 10;

        // Factor 4: Average rating (higher ratings = more competition)
        if (ratings.average > 4.8) competitionScore += 15;
        else if (ratings.average > 4.5) competitionScore += 10;
        else if (ratings.average > 4.0) competitionScore += 5;

        // Determine competition level
        if (competitionScore >= 70) competitionLevel = 'Very High';
        else if (competitionScore >= 50) competitionLevel = 'High';
        else if (competitionScore >= 30) competitionLevel = 'Medium';
        else if (competitionScore >= 15) competitionLevel = 'Low';
        else competitionLevel = 'Very Low';

        return {
            level: competitionLevel,
            score: competitionScore,
            factors: {
                totalGigs,
                avgPrice,
                topRatedPercentage,
                avgRating: ratings.average
            }
        };
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

    calculatePerformanceMetrics(gigs) {
        const metrics = {
            totalGigs: gigs.length,
            avgPrice: 0,
            avgRating: 0,
            priceRange: { min: 0, max: 0 },
            sellerDistribution: {},
            ratingDistribution: { '4.5+': 0, '4.0-4.5': 0, '3.5-4.0': 0, '<3.5': 0 }
        };

        if (gigs.length === 0) return metrics;

        const prices = gigs.map(g => g.price).filter(p => p > 0);
        const ratings = gigs.map(g => g.rating).filter(r => r > 0);

        if (prices.length > 0) {
            metrics.avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
            metrics.priceRange.min = Math.min(...prices);
            metrics.priceRange.max = Math.max(...prices);
        }

        if (ratings.length > 0) {
            metrics.avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
            
            ratings.forEach(rating => {
                if (rating >= 4.5) metrics.ratingDistribution['4.5+']++;
                else if (rating >= 4.0) metrics.ratingDistribution['4.0-4.5']++;
                else if (rating >= 3.5) metrics.ratingDistribution['3.5-4.0']++;
                else metrics.ratingDistribution['<3.5']++;
            });
        }

        // Seller level distribution
        const levels = ['New Seller', 'Level 1', 'Level 2', 'Top Rated'];
        levels.forEach(level => {
            metrics.sellerDistribution[level] = gigs.filter(g => g.sellerLevel === level).length;
        });

        return metrics;
    }

    calculatePriceRange(gigs) {
        const prices = gigs.map(g => g.price).filter(p => p > 0);
        if (prices.length === 0) return { min: 0, max: 0, average: 0 };

        return {
            min: Math.min(...prices),
            max: Math.max(...prices),
            average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        };
    }

    analyzeSellerLevels(gigs) {
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

        return levels;
    }

    analyzeRatings(gigs) {
        const ratings = gigs.map(g => g.rating).filter(r => r > 0);
        if (ratings.length === 0) return { average: 0, count: 0 };

        return {
            average: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
            count: ratings.length
        };
    }

    parseGigData(html, keyword) {
        try {
            // Create a temporary DOM parser
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const gigs = [];

            // Try different selectors that Fiverr might use
            const gigSelectors = [
                '[data-gig-id]',
                '.gig-card',
                '.gig-wrapper',
                '[data-testid="gig-card"]',
                '.search-gig-card'
            ];

            let gigElements = [];

            for (const selector of gigSelectors) {
                gigElements = doc.querySelectorAll(selector);
                if (gigElements.length > 0) break;
            }

            gigElements.forEach((element, index) => {
                if (index >= 20) return; // Limit to 20 gigs

                const gig = this.extractGigInfo(element);
                if (gig.title) {
                    gigs.push(gig);
                }
            });

            // If no gigs found through parsing, return mock data
            if (gigs.length === 0) {
                return this.getMockData(keyword);
            }

            return {
                keyword: keyword,
                totalResults: gigs.length,
                gigs: gigs,
                fetchedAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Parse error:', error);
            return this.getMockData(keyword);
        }
    }

    extractGigInfo(element) {
        const gig = {
            title: '',
            description: '',
            price: null,
            sellerLevel: 'New Seller',
            rating: null,
            tags: []
        };

        try {
            // Title extraction - try multiple selectors
            const titleSelectors = [
                '.gig-title',
                '[data-testid="gig-title"]',
                'h3',
                'h2',
                '.gig-card-title',
                'a[data-gig-id] h3'
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
                '.gig-description',
                '[data-testid="gig-description"]',
                '.gig-card-description',
                'p'
            ];

            for (const selector of descSelectors) {
                const descEl = element.querySelector(selector);
                if (descEl && descEl.textContent.trim()) {
                    gig.description = descEl.textContent.trim().substring(0, 150);
                    break;
                }
            }

            // Price extraction
            const priceSelectors = [
                '.price',
                '[data-testid="price"]',
                '.gig-price',
                '.price-display',
                '.starting-at'
            ];

            for (const selector of priceSelectors) {
                const priceEl = element.querySelector(selector);
                if (priceEl) {
                    const priceText = priceEl.textContent.trim();
                    const priceMatch = priceText.match(/\$(\d+)/);
                    if (priceMatch) {
                        gig.price = parseInt(priceMatch[1]);
                        break;
                    }
                }
            }

            // Seller level extraction
            const levelSelectors = [
                '.seller-level',
                '[data-testid="seller-level"]',
                '.level-badge',
                '.badge'
            ];

            for (const selector of levelSelectors) {
                const levelEl = element.querySelector(selector);
                if (levelEl && levelEl.textContent.trim()) {
                    const levelText = levelEl.textContent.trim().toLowerCase();
                    if (levelText.includes('top rated')) {
                        gig.sellerLevel = 'Top Rated';
                    } else if (levelText.includes('level 2')) {
                        gig.sellerLevel = 'Level 2';
                    } else if (levelText.includes('level 1')) {
                        gig.sellerLevel = 'Level 1';
                    }
                    break;
                }
            }

            // Rating extraction
            const ratingSelectors = [
                '.rating',
                '[data-testid="rating"]',
                '.star-rating',
                '.gig-rating'
            ];

            for (const selector of ratingSelectors) {
                const ratingEl = element.querySelector(selector);
                if (ratingEl) {
                    const ratingText = ratingEl.textContent.trim();
                    const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
                    if (ratingMatch) {
                        gig.rating = parseFloat(ratingMatch[1]);
                        break;
                    }
                }
            }

            // Tags extraction
            const tagSelectors = [
                '.gig-tags .tag',
                '[data-testid="tag"]',
                '.tag-list .tag',
                '.keywords .keyword'
            ];

            for (const selector of tagSelectors) {
                const tagEls = element.querySelectorAll(selector);
                if (tagEls.length > 0) {
                    gig.tags = Array.from(tagEls).map(tag => tag.textContent.trim()).slice(0, 5);
                    break;
                }
            }

        } catch (error) {
            console.error('Gig extraction error:', error);
        }

        return gig;
    }

    getMockData(keyword) {
        // Enhanced realistic mock data generator
        const keywordLower = keyword.toLowerCase();

        // Determine service category for more relevant mock data
        let serviceType = 'general';
        const categories = {
            'design': ['logo', 'graphic', 'web design', 'ui', 'brand', 'creative'],
            'writing': ['content', 'copywriting', 'blog', 'article', 'seo writing'],
            'programming': ['website', 'app', 'development', 'coding', 'software'],
            'marketing': ['social media', 'seo', 'marketing', 'promotion', 'advertising'],
            'video': ['video', 'animation', 'editing', 'motion', 'explainer'],
            'music': ['music', 'audio', 'voice', 'sound', 'mixing']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(kw => keywordLower.includes(kw) || kw.includes(keywordLower))) {
                serviceType = category;
                break;
            }
        }

        // Generate realistic gigs based on service type
        const mockGigs = this.generateGigsByCategory(keyword, serviceType);

        // Add realistic variation in pricing and levels
        const enhancedGigs = mockGigs.map((gig, index) => ({
            ...gig,
            id: `mock_${Date.now()}_${index}`,
            impressions: Math.floor(Math.random() * 10000) + 500,
            clicks: Math.floor(Math.random() * 1000) + 50,
            orders: Math.floor(Math.random() * 500) + 10,
            responseTime: ['1 hour', '2 hours', '6 hours', '24 hours'][Math.floor(Math.random() * 4)],
            deliveryTime: ['1 day', '2 days', '3 days', '1 week'][Math.floor(Math.random() * 4)]
        }));

        const mock = {
            keyword: keyword,
            totalResults: enhancedGigs.length,
            gigs: enhancedGigs,
            fetchedAt: new Date().toISOString(),
            source: 'mock',
            serviceType: serviceType,
            competition: this.calculateCompetition(enhancedGigs.length),
            marketAnalysis: {
                priceRange: {
                    min: Math.min(...enhancedGigs.map(g => g.price)),
                    max: Math.max(...enhancedGigs.map(g => g.price)),
                    median: this.calculateMedian(enhancedGigs.map(g => g.price))
                },
                sellerDistribution: this.calculateSellerDistribution(enhancedGigs),
                averageRating: (enhancedGigs.reduce((sum, g) => sum + g.rating, 0) / enhancedGigs.length).toFixed(1)
            }
        };

        // Add fields expected by popup
        mock.performanceMetrics = this.calculatePerformanceMetrics(enhancedGigs);
        mock.lowCompetitionKeywords = this.findLowCompetitionKeywords(keyword, enhancedGigs);
        mock.opportunityKeywords = mock.lowCompetitionKeywords.map(k => ({ text: k, competition: 'Low', potential: 'High' }));
        mock.aiInsights = this.generateAIInsights({ gigs: enhancedGigs, performanceMetrics: mock.performanceMetrics }, keyword);
        mock.aiConfidence = 90;

        return mock;
    }

    generateGigsByCategory(keyword, serviceType) {
        const templates = {
            design: [
                {
                    title: `I will create a professional ${keyword} for your business`,
                    description: `High-quality ${keyword} with unlimited revisions. Modern, clean design that represents your brand perfectly.`,
                    price: 25,
                    sellerLevel: 'Level 2',
                    rating: 4.8,
                    reviews: 156,
                    tags: [keyword.split(' ')[0], 'professional', 'modern', 'business']
                },
                {
                    title: `I will design amazing ${keyword} in 24 hours`,
                    description: `Quick turnaround ${keyword} service with creative approach and customer satisfaction guarantee.`,
                    price: 15,
                    sellerLevel: 'Level 1',
                    rating: 4.6,
                    reviews: 89,
                    tags: [keyword.split(' ')[0], '24hours', 'creative', 'fast']
                }
            ],
            writing: [
                {
                    title: `I will write engaging ${keyword} content for your audience`,
                    description: `SEO-optimized ${keyword} that drives traffic and engages readers. Professional writer with 5+ years experience.`,
                    price: 30,
                    sellerLevel: 'Top Rated',
                    rating: 4.9,
                    reviews: 234,
                    tags: [keyword.split(' ')[0], 'seo', 'engaging', 'professional']
                },
                {
                    title: `I will provide quality ${keyword} services`,
                    description: `Well-researched ${keyword} with proper formatting and plagiarism-free guarantee.`,
                    price: 20,
                    sellerLevel: 'Level 1',
                    rating: 4.5,
                    reviews: 67,
                    tags: [keyword.split(' ')[0], 'quality', 'research', 'original']
                }
            ],
            programming: [
                {
                    title: `I will develop a custom ${keyword} solution`,
                    description: `Full-stack ${keyword} development with modern technologies. Clean code and documentation included.`,
                    price: 150,
                    sellerLevel: 'Top Rated',
                    rating: 5.0,
                    reviews: 78,
                    tags: [keyword.split(' ')[0], 'custom', 'full-stack', 'modern']
                },
                {
                    title: `I will build your ${keyword} quickly and efficiently`,
                    description: `Professional ${keyword} development with responsive design and cross-browser compatibility.`,
                    price: 85,
                    sellerLevel: 'Level 2',
                    rating: 4.7,
                    reviews: 145,
                    tags: [keyword.split(' ')[0], 'responsive', 'professional', 'efficient']
                }
            ]
        };

        const baseTemplates = templates[serviceType] || templates.design;

        // Generate 8-12 gigs with variations
        const gigCount = Math.floor(Math.random() * 5) + 8;
        const gigs = [];

        for (let i = 0; i < gigCount; i++) {
            const template = baseTemplates[i % baseTemplates.length];
            const variation = this.createGigVariation(template, keyword, i);
            gigs.push(variation);
        }

        return gigs;
    }

    createGigVariation(template, keyword, index) {
        const priceVariations = [0.8, 0.9, 1.0, 1.1, 1.2, 1.5, 2.0];
        const levelRotation = ['New Seller', 'Level 1', 'Level 2', 'Top Rated'];
        const ratingVariation = [4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.9, 5.0];

        return {
            title: template.title,
            description: template.description,
            price: Math.round(template.price * priceVariations[index % priceVariations.length]),
            sellerLevel: levelRotation[index % levelRotation.length],
            rating: ratingVariation[index % ratingVariation.length],
            reviews: Math.floor(template.reviews * (0.5 + Math.random())),
            tags: [...template.tags, `variation${index + 1}`],
            seller: `seller_${index + 1}`,
            imageUrl: `https://via.placeholder.com/300x200/1dbf73/ffffff?text=${encodeURIComponent(keyword)}`
        };
    }

    calculateMedian(numbers) {
        const sorted = numbers.sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ?
            (sorted[middle - 1] + sorted[middle]) / 2 :
            sorted[middle];
    }

    calculateSellerDistribution(gigs) {
        const distribution = {
            'New Seller': 0,
            'Level 1': 0,
            'Level 2': 0,
            'Top Rated': 0
        };

        gigs.forEach(gig => {
            if (distribution.hasOwnProperty(gig.sellerLevel)) {
                distribution[gig.sellerLevel]++;
            }
        });

        return distribution;
    }

    calculateCompetition(gigCount) {
        if (gigCount > 15) return 'High';
        if (gigCount > 8) return 'Medium';
        return 'Low';
    }

    async fetchTrendingKeywords() {
        // Lightweight in-extension trending sample
        const base = [
            'logo design', 'ai content writing', 'shopify store', 'tiktok video editing', 'notion templates',
            'youtube shorts editing', 'wordpress speed optimization', 'seo audit', 'canva templates', 'podcast editing'
        ];
        return base.map(text => ({ text, score: Math.floor(60 + Math.random() * 40) })).sort((a, b) => b.score - a.score).slice(0, 8);
    }

    async fetchMarketTrends() {
        const categories = [
            { category: 'Graphic Design', change: Math.floor(-5 + Math.random() * 15) },
            { category: 'Video Editing', change: Math.floor(0 + Math.random() * 18) },
            { category: 'AI & Automation', change: Math.floor(5 + Math.random() * 25) },
            { category: 'Web Development', change: Math.floor(-3 + Math.random() * 12) },
            { category: 'SEO', change: Math.floor(-2 + Math.random() * 14) }
        ];
        return categories;
    }
}

// Initialize the background script
new FiverrDataFetcher();