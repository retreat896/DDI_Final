# Database Tables & Headers

### `users`
- `steam_id`, `persona_name`, `profile_url`, `avatar_url`, `last_login`, `created_at`

### `user_games`
- `steam_id`, `appid`, `playtime_forever`, `playtime_2weeks`, `last_played`

### `games`
- `appid`, `name`, `platform_windows`, `platform_mac`, `platform_linux`, `release_date`

### `game_analytics`
- `appid`, `name`, `genre_primary`, `developer`, `publisher`, `publisher_tier`, `price_initial`, `price_final`, `discount_percent`, `owners_min`, `owners_max`, `owners_midpoint`, `positive_reviews`, `negative_reviews`, `tags`, `release_date`, `ccu`, `peak_ccu`, `pc_req_min`, `pc_req_rec`, `required_age`, `languages_count`, `achievement_count`, `dlc_count`, `is_early_access`, `is_free`, `steam_deck`, `controller_support`

### `raw_game_data`
- `appid`, `steam_store_data`, `steamspy_data`, `fetched_at`

### `steam_apps`
- `appid`, `name`, `last_updated`, `is_fetched`

### `steam_games`
- `app_id`, `title`, `release_date`, `genres`, `categories`, `developer`, `publisher`, `original_price`, `discount_percentage`, `discounted_price`, `dlc_available`, `age_rating`, `content_descriptor`, `about_description`, `win_support`, `mac_support`, `linux_support`, `awards`, `overall_review`, `overall_review__`, `overall_review_count`, `recent_review`, `recent_review__`, `recent_review_count`

### `game_price_history`
- `id`, `appid`, `price_initial`, `price_final`, `discount_percent`, `recorded_at`

---

# CSV Files & Headers

### `game_analytics.csv` (inside `steam-full-market-dataset.zip`)
- `"appid"`, `"name"`, `"genre_primary"`, `"developer"`, `"publisher"`, `"publisher_tier"`, `"price_initial"`, `"price_final"`, `"discount_percent"`, `"owners_min"`, `"owners_max"`, `"owners_midpoint"`, `"positive_reviews"`, `"negative_reviews"`, `"tags"`, `"release_date"`, `"ccu"`, `"peak_ccu"`, `"pc_req_min"`, `"pc_req_rec"`, `"required_age"`, `"languages_count"`, `"achievement_count"`, `"dlc_count"`, `"is_early_access"`, `"is_free"`, `"steam_deck"`, `"controller_support"`

### `raw_game_data.csv` (inside `steam-full-market-dataset.zip`)
- `"appid"`, `"steam_store_data"`, `"steamspy_data"`, `"fetched_at"`

### `steam_apps.csv` (inside `steam-full-market-dataset.zip`)
- `"appid"`, `"name"`, `"last_updated"`, `"is_fetched"`

### `steam-games.csv` (inside `steam-store-data.zip`)
- `app_id`, `title`, `release_date`, `genres`, `categories`, `developer`, `publisher`, `original_price`, `discount_percentage`, `discounted_price`, `dlc_available`, `age_rating`, `content_descriptor`, `about_description`, `win_support`, `mac_support`, `linux_support`, `awards`, `overall_review`, `overall_review_%`, `overall_review_count`, `recent_review`, `recent_review_%`, `recent_review_count`
