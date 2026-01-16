#!/bin/bash
# Create GitHub Issues for Ultra-Simple iOS Apps
#
# Prerequisites:
#   1. Install GitHub CLI: brew install gh
#   2. Authenticate: gh auth login
#   3. Create repo if needed: gh repo create agentdevsl/agent-ios-dev --public
#
# Usage: ./create-issues.sh

REPO="agentdevsl/agent-ios-dev"

echo "Creating issues in $REPO..."

# ============================================================================
# ISSUE 1: Spin to Decide
# ============================================================================
gh issue create --repo "$REPO" \
  --title "[APP] Spin to Decide - Decision Wheel" \
  --label "app-idea,ultra-simple,priority-1" \
  --body '## 📋 Concept
A beautifully animated decision wheel. Users create custom wheels or use presets. **Interstitial ad between spins**.

## 🎯 Why This First
- **Fastest to build**: 2-3 weeks
- **Simplest mechanics**: Spin, result, repeat
- **High ad frequency**: Multiple spins per session

---

## 📊 Development: 2-3 Weeks

| Component | Days |
|-----------|------|
| Wheel UI + spin animation | 3 |
| Wheel creation (add options) | 2 |
| 5 preset wheels | 1 |
| Saving wheels (Core Data) | 1 |
| InMobi interstitial | 1 |
| Haptics + polish | 2 |
| **Total** | **10 days** |

## 🛠️ Tech Stack
```
SwiftUI + Core Animation
Core Data
InMobi SDK
UIFeedbackGenerator (haptics)
```

## 📱 Data Model
```swift
struct Wheel {
    let id: UUID
    var name: String
    var options: [String]
    var timesSpun: Int
}
```

---

## 💰 Monetization

| Placement | Format | Trigger | eCPM |
|-----------|--------|---------|------|
| Between spins | Interstitial | Every 3 spins | $8-14 |
| Custom colors | Rewarded Video | Unlock | $10-16 |

### Projected Revenue
| Month | MAU | Daily Rev | Monthly |
|-------|-----|-----------|---------|
| 3 | 15K | $65 | $1,950 |
| 6 | 40K | $180 | $5,400 |
| 12 | 90K | $400 | $12,000 |

---

## ✅ MVP Checklist

- [ ] Wheel spins with smooth deceleration
- [ ] Haptic on spin start + land
- [ ] Create wheel with 2-12 options
- [ ] 5 presets (Restaurant, Movie, Chores, Yes/No, Numbers)
- [ ] Confetti on result
- [ ] Interstitial after every 3 spins
- [ ] Works 100% offline

## 🎡 Preset Wheels
- **Restaurant**: Pizza, Sushi, Mexican, Chinese, Burger
- **Movie**: Action, Comedy, Horror, Romance, Sci-Fi
- **Chores**: Dishes, Vacuum, Laundry, Bathroom, Trash
- **Yes/No**: Yes, No, Maybe, Ask Again
- **Numbers**: 1-10

---

**Priority**: 🔴 HIGHEST - Ship first to validate InMobi'

echo "✓ Issue 1: Spin to Decide"

# ============================================================================
# ISSUE 2: Streak Saver
# ============================================================================
gh issue create --repo "$REPO" \
  --title "[APP] Streak Saver - Habit Tracker with Streak Protection" \
  --label "app-idea,ultra-simple,priority-2" \
  --body '## 📋 Concept
Universal habit tracker. The killer feature: **watch a rewarded video to save a broken streak**. Loss aversion = high ad engagement.

## 🎯 Core Loop
```
Build streak → Miss a day → "Save streak?"
→ [Watch Video] → Streak restored!
→ [Give Up] → Reset to 0
```

---

## 📊 Development: 3-4 Weeks

| Component | Days |
|-----------|------|
| Habit CRUD | 2 |
| Daily check-in | 1 |
| Streak calculation | 1 |
| Streak break detection | 1 |
| InMobi rewarded video | 2 |
| UI/animations | 3 |
| **Total** | **10-12 days** |

## 🛠️ Tech Stack
```
SwiftUI
Core Data
InMobi SDK
Local Notifications
```

## 📱 Data Model
```swift
struct Habit {
    let id: UUID
    var name: String
    var emoji: String
    var currentStreak: Int
    var longestStreak: Int
    var lastCheckIn: Date?
}
```

---

## 💰 Monetization

| Placement | Format | Trigger | eCPM |
|-----------|--------|---------|------|
| Streak save | Rewarded Video | Missed day | $12-20 |
| Daily bonus | Rewarded Video | Optional | $10-15 |
| Habit list | Banner | Passive | $2-4 |

### Why It Works
- **Loss aversion**: Users HATE losing 30-day streaks
- **High completion**: 30-sec video << losing streak
- **Repeat value**: Power users save multiple times

### Projected Revenue
| Month | MAU | Daily Rev | Monthly |
|-------|-----|-----------|---------|
| 3 | 10K | $30 | $900 |
| 6 | 30K | $100 | $3,000 |
| 12 | 70K | $250 | $7,500 |

---

## ✅ MVP Checklist

- [ ] Create habits with name + emoji
- [ ] Single-tap check-in
- [ ] Streak counter display
- [ ] Break detection on app open
- [ ] "Save Streak" rewarded video flow
- [ ] Longest streak record
- [ ] Daily reminder notifications
- [ ] Works 100% offline

---

**Priority**: 🟠 HIGH - Best retention mechanics'

echo "✓ Issue 2: Streak Saver"

# ============================================================================
# ISSUE 3: Quote Drop
# ============================================================================
gh issue create --repo "$REPO" \
  --title "[APP] Quote Drop - Daily Curated Quotes" \
  --label "app-idea,ultra-simple,priority-3" \
  --body '## 📋 Concept
Daily curated quotes with beautiful typography. **Rewarded video unlocks quote categories** (Motivation, Love, Success, etc.).

## 🎯 Core Loop
```
Open app → See today'\''s quote → Swipe for more
→ Want specific category? → [Watch Video] → Unlocked
→ Save favorites → Share to social
```

---

## 📊 Development: 2-3 Weeks

| Component | Days |
|-----------|------|
| Quote display UI | 2 |
| Quote database (bundled JSON) | 1 |
| Category system | 1 |
| Category unlock (rewarded) | 1 |
| Favorites saving | 1 |
| Share card generation | 2 |
| InMobi integration | 1 |
| **Total** | **9 days** |

## 🛠️ Tech Stack
```
SwiftUI
Bundled JSON (no backend!)
Core Data (favorites)
InMobi SDK
UIActivityViewController (share)
```

## 📱 Data Model
```swift
struct Quote {
    let id: String
    let text: String
    let author: String
    let category: String
}

// Bundled as quotes.json - 500+ quotes
```

---

## 💰 Monetization

| Placement | Format | Trigger | eCPM |
|-----------|--------|---------|------|
| Unlock category | Rewarded Video | Select locked category | $10-16 |
| Between quotes | Interstitial | Every 10 swipes | $6-12 |
| Bottom banner | Banner | Passive | $2-4 |

### Projected Revenue
| Month | MAU | Daily Rev | Monthly |
|-------|-----|-----------|---------|
| 3 | 12K | $25 | $750 |
| 6 | 35K | $75 | $2,250 |
| 12 | 80K | $180 | $5,400 |

---

## ✅ MVP Checklist

- [ ] Beautiful quote display (large typography)
- [ ] Swipe for next quote
- [ ] 3 free categories (Daily, Motivation, Wisdom)
- [ ] 4 locked categories (Love, Success, Funny, Philosophy)
- [ ] Save to favorites
- [ ] Share as image card
- [ ] Daily notification with quote
- [ ] 500+ bundled quotes (no internet needed)

## 📚 Categories
**Free**: Daily Mix, Motivation, Wisdom
**Premium** 🔒: Love, Success, Humor, Philosophy

---

**Priority**: 🟡 MEDIUM - Fast build, daily engagement'

echo "✓ Issue 3: Quote Drop"

# ============================================================================
# ISSUE 4: Countdown Collection
# ============================================================================
gh issue create --repo "$REPO" \
  --title "[APP] Countdown Collection - Event Timers with Themes" \
  --label "app-idea,ultra-simple,priority-4" \
  --body '## 📋 Concept
Beautiful countdown timers for life events (vacations, birthdays, holidays). **Rewarded video unlocks premium visual themes**.

## 🎯 Core Loop
```
Create countdown → Check daily → See beautiful display
→ Want prettier theme? → [Watch Video] → Theme unlocked
→ Event arrives → Celebration → Create next countdown
```

---

## 📊 Development: 3-4 Weeks

| Component | Days |
|-----------|------|
| Countdown creation | 2 |
| Live countdown display | 2 |
| Theme system (10 themes) | 3 |
| Theme unlock flow | 1 |
| Home screen widget | 2 |
| Notifications | 1 |
| InMobi integration | 1 |
| **Total** | **12 days** |

## 🛠️ Tech Stack
```
SwiftUI
Core Data
WidgetKit
InMobi SDK
```

## 📱 Data Model
```swift
struct Countdown {
    let id: UUID
    var name: String
    var targetDate: Date
    var emoji: String
    var themeId: String
}
```

---

## 💰 Monetization

| Placement | Format | Trigger | eCPM |
|-----------|--------|---------|------|
| Theme unlock | Rewarded Video | Select premium theme | $10-18 |
| Countdown list | Banner | Bottom of screen | $2-4 |
| After creation | Interstitial | 3rd+ countdown | $6-12 |

### Seasonal Opportunity
- 📈 2-3x installs during holidays (Christmas, NYE, summer)
- Users create multiple countdowns

### Projected Revenue
| Month | MAU | Daily Rev | Monthly |
|-------|-----|-----------|---------|
| 3 | 12K | $25 | $750 |
| 6 | 35K | $80 | $2,400 |
| 12 | 100K | $240 | $7,200 |

---

## ✅ MVP Checklist

- [ ] Create countdown (name, date, emoji)
- [ ] Live display (days, hours, mins, secs)
- [ ] 5 free themes
- [ ] 5 premium themes (rewarded unlock)
- [ ] Home screen widget (small + medium)
- [ ] Notifications (7 days, 1 day, day-of)
- [ ] Celebration animation on arrival

## 🎨 Themes
**Free**: Clean, Dark, Minimal, Pastel, Bold
**Premium** 🔒: Neon, Sunset, Ocean, Party, Elegant

---

**Priority**: 🟡 MEDIUM - Great for seasonal spikes'

echo "✓ Issue 4: Countdown Collection"

# ============================================================================
# ISSUE 5: Deadline Dungeon (Simplified)
# ============================================================================
gh issue create --repo "$REPO" \
  --title "[APP] Deadline Dungeon - Simple RPG Task Manager" \
  --label "app-idea,ultra-simple,priority-5" \
  --body '## 📋 Concept
Simplified RPG task manager. Character has a health bar tied to task completion. **Miss deadlines = health drops. Complete tasks = health restores. Die = watch video to resurrect.**

## 🎯 Core Loop
```
Add task with deadline → Complete on time → Health +10
                      → Miss deadline → Health -15
                      → Health hits 0 → Character dies
                      → [Watch Video] → Resurrect at 50% health
```

---

## 📊 Development: 4-5 Weeks

| Component | Days |
|-----------|------|
| Task CRUD | 2 |
| Character + health bar | 2 |
| Task → health logic | 2 |
| Death + resurrection | 2 |
| Character sprites (3 states) | 2 |
| Notifications | 1 |
| InMobi integration | 2 |
| Polish/animations | 2 |
| **Total** | **15 days** |

## 🛠️ Tech Stack
```
SwiftUI
Core Data
Lottie (optional, for animations)
InMobi SDK
Local Notifications
```

## 📱 Data Model
```swift
struct Task {
    let id: UUID
    var title: String
    var deadline: Date
    var isComplete: Bool
    var priority: Priority  // .low, .medium, .high
}

struct Character {
    var health: Int  // 0-100
    var state: State  // .healthy, .weak, .critical, .dead
}
```

---

## 💰 Monetization

| Placement | Format | Trigger | eCPM |
|-----------|--------|---------|------|
| Resurrection | Rewarded Video | Character dies | $12-20 |
| Health boost | Rewarded Video | Optional power-up | $10-16 |
| Task list | Banner | Bottom of screen | $2-4 |

### Why Resurrection Works
- **Urgency**: User NEEDS character alive
- **High completion**: Will watch to not lose progress
- **Repeat value**: Users die multiple times

### Projected Revenue
| Month | MAU | Daily Rev | Monthly |
|-------|-----|-----------|---------|
| 3 | 15K | $50 | $1,500 |
| 6 | 45K | $170 | $5,100 |
| 12 | 100K | $400 | $12,000 |

---

## ✅ MVP Checklist

- [ ] Create tasks with title + deadline
- [ ] Single-tap to complete
- [ ] Character with health bar (0-100)
- [ ] 3 visual states (healthy, weak, critical)
- [ ] Complete task = +10 health
- [ ] Miss deadline = -15 health
- [ ] Death at 0 health
- [ ] Resurrect via rewarded video (50% health)
- [ ] Deadline notifications
- [ ] Works 100% offline

## 🎮 Simplified vs Habitica
| Feature | Deadline Dungeon | Habitica |
|---------|-----------------|----------|
| Stats | Health only | HP, XP, Gold, Stats |
| Character | 1 simple sprite | Classes, equipment |
| Tasks | Simple deadlines | Habits, dailies, to-dos |
| Social | None | Parties, guilds |
| **Complexity** | ⭐ | ⭐⭐⭐⭐⭐ |

---

**Priority**: 🟢 NORMAL - Most features, proven category'

echo "✓ Issue 5: Deadline Dungeon"

# ============================================================================
# ISSUE 6: Overview/Roadmap
# ============================================================================
gh issue create --repo "$REPO" \
  --title "[ROADMAP] Ultra-Simple iOS Apps - Build Order" \
  --label "roadmap,documentation" \
  --body '# 🗺️ Ultra-Simple iOS Apps Roadmap

## Design Principles
- ❌ No AI/ML
- ❌ No Backend (100% local)
- ✅ SwiftUI + Native frameworks only
- ✅ 2-5 week MVPs
- ✅ Natural InMobi ad placements

---

## 📊 Comparison Matrix

| App | Dev Time | Complexity | Monthly Rev (M12) |
|-----|----------|------------|-------------------|
| Spin to Decide | 2-3 wks | ⭐ | $12K |
| Quote Drop | 2-3 wks | ⭐ | $5.4K |
| Streak Saver | 3-4 wks | ⭐ | $7.5K |
| Countdown Collection | 3-4 wks | ⭐⭐ | $7.2K |
| Deadline Dungeon | 4-5 wks | ⭐⭐ | $12K |

---

## 🚀 Recommended Build Order

### Phase 1: Validate (Weeks 1-3)
**Ship: Spin to Decide**
- Fastest to build
- Test InMobi integration
- Learn App Store submission
- Validate ad revenue model

### Phase 2: Retention (Weeks 4-7)
**Ship: Streak Saver**
- Best retention mechanics
- Strong rewarded video placement
- Builds habit-forming product skills

### Phase 3: Daily Engagement (Weeks 8-10)
**Ship: Quote Drop**
- Daily open loop
- Simple content management
- Share/viral mechanics

### Phase 4: Seasonal (Weeks 11-14)
**Ship: Countdown Collection**
- Launch before holiday season
- Widget experience
- Premium theme testing

### Phase 5: Gamification (Weeks 15-19)
**Ship: Deadline Dungeon**
- Most complex, but proven category
- Apply learnings from other apps
- Strongest long-term retention

---

## 💰 Combined Revenue Potential

| Timeframe | Monthly Revenue |
|-----------|-----------------|
| Month 6 (2 apps) | $8K-10K |
| Month 12 (4 apps) | $25K-35K |
| Month 18 (5 apps) | $40K-50K |

---

## 🔗 Related Issues
- [ ] #1 Spin to Decide
- [ ] #2 Streak Saver
- [ ] #3 Quote Drop
- [ ] #4 Countdown Collection
- [ ] #5 Deadline Dungeon'

echo "✓ Issue 6: Roadmap"

echo ""
echo "======================================"
echo "✅ All 6 issues created successfully!"
echo "======================================"
echo ""
echo "View issues: https://github.com/$REPO/issues"
