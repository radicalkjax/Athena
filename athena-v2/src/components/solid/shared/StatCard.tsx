import { Component } from 'solid-js';

interface StatCardProps {
  value: string | number;
  label: string;
}

export const StatCard: Component<StatCardProps> = (props) => {
  return (
    <div class="stat-card">
      <div class="stat-value">{props.value}</div>
      <div class="stat-label">{props.label}</div>
    </div>
  );
};