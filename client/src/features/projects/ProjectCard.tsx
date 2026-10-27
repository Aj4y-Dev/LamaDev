import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { colors } from '@/theme/tokens';
import type { Project } from '@/api/types';

export function ProjectCard({ project, onPress }: { project: Project; onPress: () => void }) {
  return (
    <Card onPress={onPress} accessibilityLabel={project.title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title" bold>{project.title}</AppText>
          {project.clientName ? <AppText muted>{project.clientName}</AppText> : null}
        </View>
        <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
      </View>
    </Card>
  );
}
