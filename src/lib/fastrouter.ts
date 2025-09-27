import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OpenAI from 'openai';

export interface DailyTip {
  title: string;
  description: string;
  emoji: string;
}

export interface HabitPlanItem {
  title: string;
  description: string;
  emoji: string;
}

const getApiKey = (): string => {
  const apiKey = Constants.expoConfig?.extra?.fastrouterApiKey;
  if (!apiKey || apiKey === 'YOUR_FASTROUTER_API_KEY_HERE') {
    console.warn('FastRouter API key not configured. Using fallback tips.');
    throw new Error('FastRouter API key not configured. Please add your API key to app.json');
  }
  
  // Basic validation
  if (!apiKey.startsWith('sk-') && !apiKey.startsWith('fr-')) {
    console.warn('API key format may be incorrect. Using fallback tips.');
  }
  
  return apiKey;
};

const getBaseUrl = (): string => {
  const baseUrl = Constants.expoConfig?.extra?.fastrouterBaseUrl;
  if (!baseUrl) {
    throw new Error('FastRouter base URL not configured. Please add fastrouterBaseUrl to app.json');
  }
  return baseUrl;
};

// Initialize OpenAI client with FastRouter
const getOpenAIClient = (): OpenAI => {
  const apiKey = getApiKey();
  const baseURL = getBaseUrl();
  
  return new OpenAI({
    apiKey,
    baseURL,
  });
};

// Fallback tips for when API fails
const fallbackTips: DailyTip[] = [
  {
    title: 'Hydrate & Glow',
    description: 'Start your day with a glass of water and a slice of lemon 🍋',
    emoji: '💧',
  },
  {
    title: 'Mindful Moments',
    description: 'Take 3 deep breaths and set an intention for your day',
    emoji: '🧘‍♀️',
  },
  {
    title: 'Move Your Body',
    description: 'Do 10 jumping jacks or stretch for 2 minutes',
    emoji: '🤸‍♀️',
  },
  {
    title: 'Gratitude Glow',
    description: 'Write down one thing you\'re grateful for today',
    emoji: '✨',
  },
  {
    title: 'Skin Care Love',
    description: 'Apply sunscreen before going outside today',
    emoji: '☀️',
  },
  {
    title: 'Digital Detox',
    description: 'Take a 5-minute break from your phone and look around you',
    emoji: '📱',
  },
  {
    title: 'Energy Boost',
    description: 'Stand up and do a quick dance to your favorite song',
    emoji: '💃',
  },
  {
    title: 'Kindness Check',
    description: 'Send a thoughtful message to someone you care about',
    emoji: '💌',
  },
];

const getRandomFallbackTip = (): DailyTip => {
  const today = new Date().getDate();
  return fallbackTips[today % fallbackTips.length];
};

export const fetchDailyTip = async (): Promise<DailyTip> => {
  try {
    const openai = getOpenAIClient();
    
    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        {
          role: 'system',
          content: `You are a friendly wellness coach for Gen Z. Your role is to provide micro-habit suggestions that are:
- Simple and achievable (5 minutes or less)
- Relevant to modern wellness trends
- Engaging and fun for young adults
- Focused on mental health, physical wellness, or self-care
- Specific to today's date and season

Always respond with a JSON object containing exactly these fields:
{
  "title": "A catchy, short title for the habit",
  "description": "A brief, encouraging description of the habit and its benefits",
  "emoji": "A single relevant emoji"
}

Keep responses concise, positive, and actionable.`,
        },
        {
          role: 'user',
          content: `Generate a single micro-habit suggestion for today (${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}). 
          
The habit should be:
- Something someone can do in 5 minutes or less
- Perfect for a ${new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()} 
- Relevant to current wellness trends
- Encouraging and achievable

Return only the JSON object with title, description, and emoji fields.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      console.warn('Invalid response from FastRouter API');
      return getRandomFallbackTip();
    }

    const content = response.choices[0].message.content?.trim();
    
    if (!content) {
      console.warn('Empty response from FastRouter API');
      return getRandomFallbackTip();
    }
    
    // Try to parse the JSON response
    try {
      const tip = JSON.parse(content);
      
      // Validate the response structure
      if (!tip.title || !tip.description || !tip.emoji) {
        console.warn('Invalid tip structure from API');
        return getRandomFallbackTip();
      }
      
      return {
        title: tip.title,
        description: tip.description,
        emoji: tip.emoji,
      };
    } catch (parseError) {
      console.warn('Failed to parse AI response, using fallback tip');
      return getRandomFallbackTip();
    }
  } catch (error) {
    console.error('Error fetching daily tip:', error);
    
    // Return a random fallback tip if API fails
    return getRandomFallbackTip();
  }
};

// Check if we should fetch a new tip (once per day)
export const shouldFetchNewTip = async (): Promise<boolean> => {
  try {
    const today = new Date().toDateString();
    const lastFetchDate = await AsyncStorage.getItem('lastTipFetchDate');
    
    return lastFetchDate !== today;
  } catch (error) {
    console.error('Error checking tip fetch date:', error);
    return true; // Default to fetching if we can't check
  }
};

// Store the current date when we fetch a tip
export const markTipAsFetched = async (): Promise<void> => {
  try {
    const today = new Date().toDateString();
    await AsyncStorage.setItem('lastTipFetchDate', today);
  } catch (error) {
    console.error('Error storing tip fetch date:', error);
  }
};

// Test function to validate API key and connection
export const testApiConnection = async (): Promise<boolean> => {
  try {
    const openai = getOpenAIClient();
    const apiKey = getApiKey();
    console.log('API Key found:', apiKey.substring(0, 10) + '...');
    
    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        {
          role: 'user',
          content: 'Hello, respond with just "OK"',
        },
      ],
      max_tokens: 10,
    });

    console.log('API Response Status: OK');
    return true;
  } catch (error: any) {
    console.error('API Test Error:', error);
    
    if (error.status === 402) {
      console.error('API Error 402: Payment Required - Check your FastRouter account billing');
      return false;
    }
    
    if (error.status === 401) {
      console.error('API Error 401: Unauthorized - Check your API key');
      return false;
    }
    
    return false;
  }
};

// Generate a plan of 3-5 habits based on a user's goal
export const generateHabitPlan = async (goal: string): Promise<HabitPlanItem[]> => {
  try {
    const openai = getOpenAIClient();

    const response = await openai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-20250514',
      messages: [
        {
          role: 'system',
          content: `You are a friendly Gen Z wellness coach. Create a short plan of micro-habits tailored to a user's goal. 
Rules:
- Make each habit specific, action-oriented, and doable in 5 minutes or less.
- Keep copy concise, positive, and trend-aware.
- Use inclusive, supportive tone.
- Return ONLY valid JSON. No extra text.

Response format: an array (length 3-5) of objects with exactly these keys:
[
  { "title": string, "description": string, "emoji": string }
]
`,
        },
        {
          role: 'user',
          content: `Goal: "${goal}"

As a wellness coach for Gen Z, generate 3 to 5 micro-habits that best help achieve this goal. Return ONLY a JSON array of objects with keys title, description, emoji.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      console.warn('Empty habit plan response from AI');
      return getFallbackPlan(goal);
    }

    try {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) {
        console.warn('Habit plan response was not an array');
        return getFallbackPlan(goal);
      }

      const normalized: HabitPlanItem[] = parsed
        .filter(item => item && typeof item === 'object')
        .map(item => ({
          title: String(item.title || '').slice(0, 80) || 'Quick Habit',
          description: String(item.description || '').slice(0, 200) || 'Do a quick positive action to move toward your goal.',
          emoji: String(item.emoji || '✨'),
        }))
        .slice(0, 5);

      if (normalized.length < 3) {
        return getFallbackPlan(goal);
      }

      return normalized;
    } catch (e) {
      console.warn('Failed to parse habit plan JSON. Using fallback.');
      return getFallbackPlan(goal);
    }
  } catch (error) {
    console.error('Error generating habit plan:', error);
    return getFallbackPlan(goal);
  }
};

const getFallbackPlan = (goal: string): HabitPlanItem[] => {
  const base: HabitPlanItem[] = [
    {
      title: 'Two-Minute Start',
      description: 'Spend 2 minutes on one tiny task that supports your goal.',
      emoji: '⏱️',
    },
    {
      title: 'Hydrate Now',
      description: 'Drink a glass of water to boost energy and clarity.',
      emoji: '💧',
    },
    {
      title: 'Gratitude Note',
      description: 'Write 1 thing you appreciate about your journey.',
      emoji: '✨',
    },
  ];

  // Light tailoring for common goals
  const g = goal.toLowerCase();
  if (g.includes('bulk') || g.includes('muscle')) {
    return [
      { title: 'Protein Check', description: 'Add a quick protein snack (yogurt, nuts, shake).', emoji: '🥛' },
      { title: 'Mini Push Set', description: 'Do 10 push-ups or 20 second wall push hold.', emoji: '💪' },
      { title: 'Hydrate Now', description: 'Drink a glass of water to support performance.', emoji: '💧' },
    ];
  }
  if (g.includes('face') || g.includes('jaw') || g.includes('structure')) {
    return [
      { title: 'Posture Reset', description: '1 minute chin tuck and shoulder roll.', emoji: '🧘' },
      { title: 'Skincare SPF', description: 'Apply sunscreen or moisturizer for skin health.', emoji: '🧴' },
      { title: 'Hydrate Now', description: 'Sip water for skin and overall glow.', emoji: '💧' },
    ];
  }
  return base;
};
