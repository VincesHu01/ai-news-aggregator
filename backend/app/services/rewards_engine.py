import math
import random
from typing import Tuple, List, Dict


class RewardsEngine:
    LEVEL_THRESHOLDS = [
        (1, 0),
        (2, 100),
        (3, 300),
        (4, 600),
        (5, 1000),
        (6, 1500),
        (7, 2100),
        (8, 2800),
        (9, 3600),
        (10, 4500),
        (11, 5500),
        (12, 6600),
        (13, 7800),
        (14, 9100),
        (15, 10500),
        (16, 12000),
        (17, 13600),
        (18, 15300),
        (19, 17100),
        (20, 19000),
    ]

    CARD_RARITY_WEIGHTS = {
        "SSR": 1,
        "SR": 5,
        "R": 20,
        "N": 74,
    }

    READING_BASE_POINTS = 5
    READING_BASE_EXPERIENCE = 3

    CHECKIN_BASE_POINTS = 20
    CHECKIN_BASE_EXPERIENCE = 10
    STREAK_MULTIPLIER = 0.5

    DRAW_CARD_COST = 50

    def get_level_from_experience(self, experience: int) -> int:
        level = 1
        for threshold_level, threshold_exp in self.LEVEL_THRESHOLDS:
            if experience >= threshold_exp:
                level = threshold_level
            else:
                break
        return level

    def get_next_level_experience(self, current_level: int) -> int:
        for threshold_level, threshold_exp in self.LEVEL_THRESHOLDS:
            if threshold_level == current_level + 1:
                return threshold_exp
        return self.LEVEL_THRESHOLDS[-1][1] + 5000

    def calculate_reading_rewards(
        self, read_duration: int
    ) -> Tuple[int, int]:
        if read_duration < 5:
            return 0, 0
        duration_multiplier = min(read_duration / 30.0, 3.0)
        # 满 5 秒即发放完整基准奖励（不再 *read_duration/30 的小于1惩罚）
        duration_multiplier = max(duration_multiplier, 1.0)
        points = int(self.READING_BASE_POINTS * duration_multiplier)
        experience = int(self.READING_BASE_EXPERIENCE * duration_multiplier)
        return points, experience

    def calculate_checkin_rewards(
        self, streak_days: int
    ) -> Tuple[int, int]:
        streak_bonus = int(self.CHECKIN_BASE_POINTS * self.STREAK_MULTIPLIER * min(streak_days, 30))
        points = self.CHECKIN_BASE_POINTS + streak_bonus
        experience = self.CHECKIN_BASE_EXPERIENCE + int(streak_bonus * 0.5)
        return points, experience

    def calculate_draw_card_rarity(self) -> str:
        rarities = list(self.CARD_RARITY_WEIGHTS.keys())
        weights = list(self.CARD_RARITY_WEIGHTS.values())
        total = sum(weights)
        probabilities = [w / total for w in weights]
        return random.choices(rarities, weights=probabilities, k=1)[0]

    def get_level_privileges(self, level: int) -> Dict:
        privileges = {
            1: {"daily_draws": 3, "max_reading_points": 50},
            3: {"daily_draws": 5, "max_reading_points": 80, "unlock_predictions": True},
            5: {"daily_draws": 8, "max_reading_points": 120, "unlock_advanced_stats": True},
            8: {"daily_draws": 12, "max_reading_points": 180, "unlock_custom_feeds": True},
            10: {"daily_draws": 15, "max_reading_points": 250, "unlock_expert_mode": True},
            15: {"daily_draws": 20, "max_reading_points": 400, "unlock_ai_mentor": True},
            20: {"daily_draws": 30, "max_reading_points": 600, "unlock_all_features": True},
        }
        best_privileges = {}
        for lvl in sorted(privileges.keys()):
            if lvl <= level:
                best_privileges.update(privileges[lvl])
        return best_privileges

    def calculate_intelligence(self, cards_read: int, prediction_accuracy: float) -> int:
        base_score = cards_read * 10
        accuracy_bonus = int(prediction_accuracy * 100)
        return base_score + accuracy_bonus

    def get_total_experience_for_level(self, level: int) -> int:
        for threshold_level, threshold_exp in self.LEVEL_THRESHOLDS:
            if threshold_level == level:
                return threshold_exp
        return 0

    def format_experience_progress(self, current_experience: int, current_level: int) -> Dict:
        current_level_exp = self.get_total_experience_for_level(current_level)
        next_level_exp = self.get_next_level_experience(current_level)
        progress = (
            (current_experience - current_level_exp)
            / (next_level_exp - current_level_exp)
            * 100
        )
        return {
            "current_level_exp": current_level_exp,
            "next_level_exp": next_level_exp,
            "progress_percent": round(min(max(progress, 0), 100), 1),
        }