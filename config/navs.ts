// icons: https://icones.js.org/collection/ri
import type { NavItem } from '~/types/app-config'

export default [
  {
    label: '仪表盘',
    icon: 'ri:dashboard-line',
    to: '/dashboard',
  },
  {
    label: 'UniLake',
    icon: 'ri:database-2-line',
    children: [
      {
        label: 'Lakebase',
        to: '/ai-datalake/lakebase',
        icon: 'ri:stack-line',
      },
      {
        label: 'Lakehouse',
        to: '/ai-datalake/lakehouse',
        icon: 'ri:home-gear-line',
      },
      {
        label: 'Catalog',
        to: '/ai-datalake/catalog',
        icon: 'ri:book-line',
      },
      {
        label: 'Volume Catalog',
        to: '/ai-datalake/volume-catalog',
        icon: 'ri:file-list-line',
      },
    ],
  },
  {
    label: 'Object Storage',
    icon: 'ri:database-line',
    children: [
      {
        label: 'Browser',
        to: '/browser',
        icon: 'ri:box-3-line',
      },
      {
        label: 'Access Keys',
        to: '/access-keys',
        icon: 'ri:door-lock-line',
      },
      {
        label: 'Policies',
        to: '/policies',
        icon: 'ri:shield-check-line',
        isAdminOnly: true,
      },
      {
        label: 'Users',
        to: '/users',
        icon: 'ri:file-user-line',
        isAdminOnly: true,
      },
      {
        label: 'User Groups',
        to: '/user-groups',
        icon: 'ri:group-line',
        isAdminOnly: true,
      },
      {
        label: 'Import/Export',
        to: '/import-export',
        icon: 'ri:download-2-line',
        isAdminOnly: true,
      },
      {
        label: 'Performance',
        to: '/performance',
        icon: 'ri:bar-chart-box-line',
        isAdminOnly: true,
      },
      // {
      //   label: 'Site Replication',
      //   to: '/site-replication',
      //   icon: 'ri:upload-cloud-2-line',
      // },
      {
        label: 'Bucket Setting',
        icon: 'ri:settings-2-line',
        isAdminOnly: true,
        children: [
          {
            label: 'Bucket Events',
            to: '/events',
            icon: 'ri:broadcast-line',
          },
          {
            label: 'Bucket Replication',
            to: '/replication',
            icon: 'ri:file-copy-line',
          },
          {
            label: 'Lifecycle',
            to: '/lifecycle',
            icon: 'ri:exchange-2-line',
          },
        ],
      },
      {
        label: 'Tiered Storage',
        to: '/tiers',
        icon: 'ri:stack-line',
        isAdminOnly: true,
      },
      {
        label: 'Event Destinations',
        to: '/events-target',
        icon: 'ri:bookmark-3-line',
        isAdminOnly: true,
      },
      {
        label: 'SSE Settings',
        to: '/sse',
        icon: 'ri:secure-payment-line',
        isAdminOnly: true,
      },
    ],
  },
  {
    label: '文件系统',
    icon: 'ri:folder-line',
    children: [
      {
        label: '目录管理',
        to: '/filesystem/dirs',
        icon: 'ri:folder-open-line',
      },
      {
        label: 'QoS策略',
        to: '/filesystem/qos',
        icon: 'ri:slideshow-2-line',
      },
      {
        label: '快照',
        to: '/filesystem/snapshots',
        icon: 'ri:snapchat-line',
      },
      {
        label: '备份',
        to: '/filesystem/backups',
        icon: 'ri:archive-line',
      },
    ],
  },
  {
    label: 'Access Control',
    icon: 'ri:shield-check-line',
    isAdminOnly: true,
    children: [
      {
        label: 'Permission Policies',
        to: '/access-control/policies',
        icon: 'ri:file-shield-line',
      },
    ],
  },
  {
    label: '监控',
    icon: 'ri:line-chart-line',
    children: [
      {
        label: '指标',
        to: '/monitoring/metrics',
        icon: 'ri:bar-chart-2-line',
      },
      {
        label: '事件',
        to: '/monitoring/events',
        icon: 'ri:notification-3-line',
      },
      {
        label: '告警',
        to: '/monitoring/alerts',
        icon: 'ri:alarm-warning-line',
      },
    ],
  },
] as NavItem[]
