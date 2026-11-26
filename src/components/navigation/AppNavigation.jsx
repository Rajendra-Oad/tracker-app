import { Icon } from "../ui/Icon";

export function ProfileTrigger({ profile, onOpen }) {
  const initials = profile?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return <button type="button" className="profile-trigger" aria-label={`Open ${profile?.name ? `${profile.name}'s profile` : "profile"}`} onClick={onOpen}>
    <span aria-hidden="true">{initials || <Icon name="user" size={20} />}</span>
  </button>;
}

export function Nav({ tab, setTab }) {
  const items = [["today", "dumbbell", "Train"], ["plan", "checks", "Plan"], ["progress", "trend", "Progress"]];

  return <nav className="bottom-nav" aria-label="Primary navigation">
    {items.map(([value, icon, label]) => {
      const active = tab === value;
      return <button key={value} type="button" className={active ? "on" : ""} aria-label={label} aria-current={active ? "page" : undefined} onClick={() => setTab(value)}>
        <Icon name={icon} />
        <span>{label}</span>
      </button>;
    })}
  </nav>;
}
