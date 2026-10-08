"""Descriptive journal insights, using local clock times across midnight."""
from datetime import date, time
from math import atan2, cos, sin, pi
from statistics import mean


def minutes(value):
    if isinstance(value, str):
        value = time.fromisoformat(value)
    return value.hour * 60 + value.minute


def clock(value):
    value = round(value) % 1440
    return f"{value // 60:02d}:{value % 60:02d}"


def average_clock(values):
    angles = [v * 2 * pi / 1440 for v in values]
    x, y = mean(cos(a) for a in angles), mean(sin(a) for a in angles)
    if x * x + y * y < 0.01:
        return None
    return clock(atan2(y, x) * 1440 / (2 * pi))


def calculate_overview(entries):
    dates = [date.fromisoformat(row['sleep_date']) if isinstance(row['sleep_date'], str)
             else row['sleep_date'] for row in entries]
    total = sum((minutes(row['wake_time']) - minutes(row['bedtime'])) % 1440 / 60
                for row in entries)
    return {'entry_count': len(entries), 'first_entry_date': min(dates) if dates else None,
            'total_sleep_hours': round(total, 2)}


def calculate_stats(entries, settings, days=30, today=None):
    today = today or date.today()
    rows = []
    for entry in entries:
        sleep_date = entry['sleep_date']
        if isinstance(sleep_date, str):
            sleep_date = date.fromisoformat(sleep_date)
        if not 0 <= (today - sleep_date).days < days:
            continue
        bed, wake = minutes(entry['bedtime']), minutes(entry['wake_time'])
        duration = (wake - bed) % 1440 / 60
        if duration:
            rows.append({**entry, 'sleep_date': sleep_date, 'hours': duration})
    rows.sort(key=lambda row: (row['sleep_date'], row['id']))
    goal = float(settings['sleep_goal_hours'])
    result = {
        'days': days, 'entry_count': len(rows), 'sleep_goal_hours': goal,
        'suggested_bedtime': clock(minutes(settings['target_wake_time']) - goal * 60),
        'target_wake_time': clock(minutes(settings['target_wake_time'])),
        'average_hours': None, 'average_quality': None, 'average_bedtime': None,
        'average_wake_time': None, 'best_bedtime': None, 'best_bedtime_samples': 0,
        'goal_met_count': 0, 'best_night': None,
        'history': [{'sleep_date': row['sleep_date'], 'hours': round(row['hours'], 2), 'quality': row['quality']} for row in rows],
    }
    if not rows:
        return result
    result.update(
        average_hours=round(mean(row['hours'] for row in rows), 2),
        average_quality=round(mean(row['quality'] for row in rows), 2),
        average_bedtime=average_clock([minutes(row['bedtime']) for row in rows]),
        average_wake_time=average_clock([minutes(row['wake_time']) for row in rows]),
        goal_met_count=sum(row['hours'] >= goal for row in rows),
    )
    best = max(rows, key=lambda row: (row['quality'], -abs(row['hours'] - goal), row['sleep_date']))
    result['best_night'] = {'sleep_date': best['sleep_date'], 'quality': best['quality'], 'hours': round(best['hours'], 2)}
    good = [row for row in rows if row['quality'] >= 4]
    result['best_bedtime_samples'] = len(good)
    if len(good) >= 3:
        result['best_bedtime'] = average_clock([minutes(row['bedtime']) for row in good])
    return result
