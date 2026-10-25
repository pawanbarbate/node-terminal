import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { ServiceConfig } from '../../types/config.js';

export interface ServiceListReviewProps {
  services: ServiceConfig[];
  onAddAnother: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onSaveAndLaunch: () => void;
  onCancel: () => void;
  width?: number;
}

type ActionButton = 'add' | 'edit' | 'delete' | 'launch';

export const ServiceListReview: React.FC<ServiceListReviewProps> = ({
  services,
  onAddAnother,
  onEdit,
  onDelete,
  onSaveAndLaunch,
  onCancel,
  width = 80
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedAction, setSelectedAction] = useState<ActionButton>('add');
  const [navZone, setNavZone] = useState<'list' | 'actions'>('list');

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    // Direct key shortcuts
    if (input === 'a' || input === '+') {
      onAddAnother();
      return;
    }
    if (input === 'e') {
      if (services.length > 0) onEdit(selectedIndex);
      return;
    }
    if (input === 'd') {
      if (services.length > 0) onDelete(selectedIndex);
      return;
    }
    if (input === 'l' || input === 's') {
      if (services.length > 0) onSaveAndLaunch();
      return;
    }

    // Navigation between zones (Tab or Left/Right/Up/Down)
    if (key.tab) {
      setNavZone(prev => (prev === 'list' ? 'actions' : 'list'));
      return;
    }

    if (navZone === 'list') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        if (selectedIndex === services.length - 1) {
          setNavZone('actions');
        } else {
          setSelectedIndex(prev => Math.min(services.length - 1, prev + 1));
        }
      } else if (key.return) {
        onEdit(selectedIndex);
      }
    } else {
      // Actions zone
      const actions: ActionButton[] = ['add', 'edit', 'delete', 'launch'];
      const curIdx = actions.indexOf(selectedAction);

      if (key.leftArrow || input === 'h') {
        setSelectedAction(actions[Math.max(0, curIdx - 1)]!);
      } else if (key.rightArrow || input === 'l') {
        setSelectedAction(actions[Math.min(actions.length - 1, curIdx + 1)]!);
      } else if (key.upArrow || input === 'k') {
        setNavZone('list');
      } else if (key.return) {
        if (selectedAction === 'add') onAddAnother();
        else if (selectedAction === 'edit') onEdit(selectedIndex);
        else if (selectedAction === 'delete') onDelete(selectedIndex);
        else if (selectedAction === 'launch') onSaveAndLaunch();
      }
    }
  });

  const cardWidth = Math.min(width - 2, 74);

  return (
    <Box 
      borderStyle="round" 
      borderColor="#22c55e" 
      flexDirection="column" 
      paddingX={1} 
      paddingY={0}
      width={cardWidth}
    >
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between" marginBottom={0}>
        <Text color="#22c55e" bold>
          ✔ Service Registry ({services.length} configured)
        </Text>
        <Text color="#64748b">[ESC: Back]</Text>
      </Box>

      <Box marginY={0}>
        <Text color="#94a3b8">
          The following services will be registered into <Text color="#38bdf8">devpulse.config.json</Text>:
        </Text>
      </Box>

      {/* Services List Table */}
      <Box flexDirection="column" marginY={1}>
        {services.map((svc, idx) => {
          const isSelected = idx === selectedIndex && navZone === 'list';

          return (
            <Box 
              key={idx}
              flexDirection="row" 
              justifyContent="space-between"
              alignItems="center"
              backgroundColor={isSelected ? '#1e293b' : undefined}
              paddingX={1}
            >
              <Box flexDirection="row" alignItems="center">
                <Text color={isSelected ? '#38bdf8' : '#22c55e'} bold>
                  {isSelected ? '▶ ' : '● '}
                </Text>
                <Text color={isSelected ? 'white' : '#cbd5e1'} bold={isSelected}>
                  {svc.name}{' '}
                </Text>
                <Text color="#64748b">({svc.path})</Text>
              </Box>

              <Box flexDirection="row" alignItems="center">
                <Text color="#38bdf8">"{svc.command}" </Text>
                {svc.port && <Text color="#a855f7">:{svc.port} </Text>}
                <Text color={svc.autoStart !== false ? '#22c55e' : '#64748b'}>
                  [{svc.autoStart !== false ? 'Auto' : 'Manual'}]
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Multiplier Actions */}
      <Box flexDirection="column" marginTop={1}>
        {/* Row 1: Item management buttons */}
        <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
          <Box 
            backgroundColor={navZone === 'actions' && selectedAction === 'add' ? '#0369a1' : '#1e293b'}
            paddingX={1}
          >
            <Text color={navZone === 'actions' && selectedAction === 'add' ? 'white' : '#38bdf8'} bold>
              + Add Another Service (a)
            </Text>
          </Box>

          <Box 
            backgroundColor={navZone === 'actions' && selectedAction === 'edit' ? '#0369a1' : '#1e293b'}
            paddingX={1}
          >
            <Text color={navZone === 'actions' && selectedAction === 'edit' ? 'white' : '#cbd5e1'}>
              ✏ Edit Selected (e)
            </Text>
          </Box>

          <Box 
            backgroundColor={navZone === 'actions' && selectedAction === 'delete' ? '#991b1b' : '#1e293b'}
            paddingX={1}
          >
            <Text color={navZone === 'actions' && selectedAction === 'delete' ? 'white' : '#ef4444'}>
              ✖ Remove (d)
            </Text>
          </Box>
        </Box>

        {/* Row 2: Prominent Save & Launch CTA */}
        <Box 
          backgroundColor={navZone === 'actions' && selectedAction === 'launch' ? '#166534' : '#14532d'}
          paddingX={2}
          paddingY={0}
          justifyContent="center"
          alignItems="center"
        >
          <Text color="white" bold>
            ✔ Save devpulse.config.json & Launch DevPulse Dashboard
          </Text>
        </Box>
      </Box>

      {/* Footer shortcut hints */}
      <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
        <Text color="#64748b">
          [↑↓] Select service  •  [Tab] Switch focus  •  [Enter] Confirm
        </Text>
        <Text color="#64748b">
          Press [s] to save & boot
        </Text>
      </Box>
    </Box>
  );
};

export default ServiceListReview;

