import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Screen from '../components/Screen';
import HelmGlyph from '../components/HelmGlyph';
import Button from '../components/Button';
import StatusDot from '../components/StatusDot';
import ConnectionPill from '../components/ConnectionPill';
import ReconnectBar from '../components/ReconnectBar';
import OfflineScreen from './OfflineScreen';
import { colors, fonts, radius } from '../theme';
import { useRelay } from '../lib/connection';
import { clearPairing } from '../lib/storage';

/** Known agents → display metadata, so we can also show ones NOT installed. */
const AGENT_META = {
  claude: { icon: 'layers', desc: 'Conversational, file-editing agent. Best for multi-step work.' },
  codex: { icon: 'code', desc: 'Direct code-completion CLI. Fast, focused edits.' },
  antigravity: { icon: 'box', desc: 'Local tool assistant. Install on your laptop to enable.' },
};
const KNOWN_AGENTS = [
  { id: 'claude', name: 'Claude Code' },
  { id: 'codex', name: 'Codex' },
  { id: 'antigravity', name: 'Antigravity' },
];

export default function DashboardScreen({ navigation }) {
  const [tab, setTab] = useState('projects');
  const { status, projects, conn } = useRelay();

  // Hard offline: we can't even reach the relay AND have nothing to show yet.
  // (If a catalog is already loaded we keep the dashboard up with a soft
  // reconnect bar instead of yanking the user out — avoids reconnect flicker.)
  if (status === 'disconnected' && projects.length === 0) {
    return (
      <OfflineScreen
        onRetry={() => conn.retryNow()}
        onRepair={() => navigation.navigate('Scan')}
      />
    );
  }

  return (
    <Screen edges={['top']}>
      <View style={styles.topbar}>
        <View style={styles.left}>
          <HelmGlyph size={30} radius={9} />
          <ConnectionPill status={status} />
        </View>
        <Pressable style={styles.avatar} onPress={() => setTab('account')}>
          <Text style={styles.avatarTxt}>VS</Text>
        </Pressable>
      </View>

      {status !== 'online' && <ReconnectBar label={reconnectLabel(status)} />}

      <View style={styles.body}>
        {tab === 'projects' && <ProjectsTab navigation={navigation} />}
        {tab === 'agents' && <AgentsTab />}
        {tab === 'settings' && <SettingsTab navigation={navigation} />}
        {tab === 'account' && <AccountTab navigation={navigation} />}
      </View>

      <TabBar tab={tab} setTab={setTab} />
    </Screen>
  );
}

function reconnectLabel(status) {
  if (status === 'waiting') return 'Laptop offline — waiting for it to come online…';
  if (status === 'connecting') return 'Connecting to your laptop…';
  return 'Reconnecting to your laptop…';
}

// ---- PROJECTS ----------------------------------------------------------
function ProjectsTab({ navigation }) {
  const { projects, status } = useRelay();
  return (
    <View style={styles.pane}>
      <Text style={styles.section}>Projects</Text>
      <Text style={styles.sectionSub}>
        {projects.length
          ? `${projects.length} ${projects.length === 1 ? 'directory' : 'directories'} authorized`
          : 'no directories authorized yet'}
      </Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        {projects.length === 0 ? (
          <EmptyHint
            icon="folder"
            title={status === 'online' ? 'No projects yet' : 'Waiting for your laptop'}
            body={
              status === 'online'
                ? 'Open HELM Desktop on your laptop and authorize a project folder to see it here.'
                : 'Project folders appear once your laptop is reachable.'
            }
          />
        ) : (
          <View style={{ gap: 11 }}>
            {projects.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                onPress={() =>
                  navigation.navigate('Task', { projectId: p.id, projectName: p.name })
                }
                disabled={status !== 'online'}
              >
                <View style={styles.cardIc}>
                  <Feather name="folder" size={18} color={colors.inkMid} />
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardName}>{p.name}</Text>
                  <Text style={styles.cardPath} numberOfLines={1}>
                    {p.path}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={colors.inkLo} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.ghostRow}>
          <Feather name="plus" size={15} color={colors.inkMid} />
          <Text style={styles.ghostTxt}>Authorize directories in HELM Desktop</Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ---- AGENTS ------------------------------------------------------------
function AgentsTab() {
  const { agents, selectedAgentId, conn } = useRelay();
  const detected = new Map(agents.map((a) => [a.id, a]));
  // merge known agents with detection so missing ones show as "not installed"
  const rows = KNOWN_AGENTS.map((k) => ({
    ...k,
    name: detected.get(k.id)?.name || k.name,
    installed: detected.has(k.id),
  }));

  return (
    <View style={styles.pane}>
      <Text style={styles.section}>Agents</Text>
      <Text style={styles.sectionSub}>detected on this laptop</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        <View style={{ gap: 11 }}>
          {rows.map((a) => {
            const selected = a.installed && selectedAgentId === a.id;
            return (
              <Pressable
                key={a.id}
                disabled={!a.installed}
                onPress={() => conn.selectAgent(a.id)}
                style={({ pressed }) => [
                  styles.card,
                  selected && styles.cardSelected,
                  !a.installed && styles.cardDisabled,
                  pressed && a.installed && styles.cardPressed,
                ]}
              >
                <View style={styles.cardIc}>
                  <Feather name={AGENT_META[a.id]?.icon || 'cpu'} size={18} color={colors.inkMid} />
                </View>
                <View style={styles.cardMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.cardName}>{a.name}</Text>
                    {selected && <Tag label="Selected" variant="on" />}
                    {!a.installed && <Tag label="Not installed" variant="off" />}
                  </View>
                  <Text style={styles.agentDesc}>{AGENT_META[a.id]?.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ---- SETTINGS ----------------------------------------------------------
function SettingsTab({ navigation }) {
  const { conn } = useRelay();
  const [notifications, setNotifications] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);

  const unpair = async () => {
    await clearPairing();
    conn.stop();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.pane}>
      <Text style={styles.section}>Settings</Text>
      <Text style={styles.sectionSub}>app & connection</Text>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
        <ListGroup>
          <Row icon="sun" label="Appearance" value="Dark" chevron />
          <Row icon="bell" label="Notifications" toggle value={notifications} onToggle={() => setNotifications((v) => !v)} />
          <Row icon="zap" label="Keep laptop awake" toggle value={keepAwake} onToggle={() => setKeepAwake((v) => !v)} last />
        </ListGroup>
        <View style={{ height: 14 }} />
        <ListGroup>
          <Row icon="monitor" label="Paired laptop" value="Laptop" chevron />
          <Row icon="x" label="Unpair this device" labelDim onPress={unpair} last />
        </ListGroup>
      </ScrollView>
    </View>
  );
}

// ---- ACCOUNT -----------------------------------------------------------
function AccountTab({ navigation }) {
  const { conn } = useRelay();
  const logout = async () => {
    await clearPairing();
    conn.stop();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  return (
    <View style={styles.pane}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12, paddingTop: 8 }}>
        <View style={styles.accountHero}>
          <View style={styles.avatarLg}>
            <Text style={styles.avatarLgTxt}>VS</Text>
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={styles.accountName}>HELM user</Text>
            <Text style={styles.accountEmail}>signed in on this device</Text>
          </View>
        </View>
        <ListGroup>
          <Row icon="shield" label="Plan" value="Pro" chevron />
          <Row icon="user" label="Manage account" chevron />
          <Row icon="help-circle" label="Help & support" chevron last />
        </ListGroup>
        <View style={{ height: 18 }} />
        <Button label="Log out" variant="ghost" icon="log-out" onPress={logout} />
      </ScrollView>
    </View>
  );
}

// ---- shared bits -------------------------------------------------------
function TabBar({ tab, setTab }) {
  const tabs = [
    { id: 'projects', icon: 'folder', label: 'Projects' },
    { id: 'agents', icon: 'layers', label: 'Agents' },
    { id: 'settings', icon: 'settings', label: 'Settings' },
    { id: 'account', icon: 'user', label: 'Account' },
  ];
  return (
    <View style={styles.tabbar}>
      {tabs.map((t) => {
        const active = tab === t.id;
        return (
          <Pressable key={t.id} style={styles.tab} onPress={() => setTab(t.id)}>
            <Feather name={t.icon} size={21} color={active ? colors.inkHi : colors.inkLo} />
            <Text style={[styles.tabLabel, { color: active ? colors.inkHi : colors.inkLo }]}>
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ListGroup({ children }) {
  return <View style={styles.list}>{children}</View>;
}

function Row({ icon, label, value, chevron, toggle, onToggle, onPress, last, labelDim }) {
  return (
    <Pressable
      onPress={toggle ? onToggle : onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && onPress && styles.rowPressed]}
    >
      <View style={styles.rowIc}>
        <Feather name={icon} size={17} color={colors.inkMid} />
      </View>
      <Text style={[styles.rowLabel, labelDim && { color: colors.inkMid }]}>{label}</Text>
      {value ? <Text style={styles.rowVal}>{value}</Text> : null}
      {toggle ? <Switch on={value} /> : null}
      {chevron ? <Feather name="chevron-right" size={15} color={colors.inkLo} /> : null}
    </Pressable>
  );
}

function Switch({ on }) {
  return (
    <View style={[styles.switch, on && styles.switchOn]}>
      <View style={[styles.knob, on && styles.knobOn]} />
    </View>
  );
}

function Tag({ label, variant }) {
  return (
    <View
      style={[
        styles.tag,
        variant === 'on' && styles.tagOn,
        variant === 'off' && styles.tagOff,
      ]}
    >
      <Text
        style={[
          styles.tagTxt,
          variant === 'on' && { color: colors.onFill },
          variant === 'off' && { color: colors.inkLo },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function EmptyHint({ icon, title, body }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIc}>
        <Feather name={icon} size={22} color={colors.inkMid} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 12, fontWeight: '600', color: colors.inkHi },

  body: { flex: 1 },
  pane: { flex: 1, paddingHorizontal: 22, paddingTop: 20 },
  section: { fontSize: 21, fontWeight: '600', letterSpacing: -0.3, color: colors.inkHi },
  sectionSub: { fontSize: 13, color: colors.inkLo, marginTop: 4, marginBottom: 18, fontFamily: fonts.mono },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardPressed: { transform: [{ scale: 0.985 }], borderColor: colors.hairline2 },
  cardSelected: { borderColor: colors.inkHi, backgroundColor: '#1a1a1e' },
  cardDisabled: { opacity: 0.42 },
  cardIc: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15, color: colors.inkHi },
  cardPath: { fontFamily: fonts.mono, fontSize: 11.5, color: colors.inkMid, marginTop: 3 },
  agentDesc: { fontSize: 12, color: colors.inkLo, marginTop: 3, lineHeight: 16 },

  ghostRow: {
    marginTop: 13,
    height: 50,
    borderWidth: 1,
    borderColor: colors.hairline2,
    borderStyle: 'dashed',
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  ghostTxt: { color: colors.inkMid, fontSize: 13 },

  tag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.hairline2,
  },
  tagOn: { backgroundColor: colors.fill, borderColor: colors.fill },
  tagOff: { borderStyle: 'dashed' },
  tagTxt: { fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 0.8, color: colors.inkMid, textTransform: 'uppercase' },

  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 16, paddingVertical: 15 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.hairline },
  rowPressed: { backgroundColor: '#16161a' },
  rowIc: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 14.5, color: colors.inkHi },
  rowVal: { fontSize: 12.5, color: colors.inkLo, fontFamily: fonts.mono },

  switch: {
    width: 40,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline2,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.fill, borderColor: colors.fill },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.inkMid, marginLeft: 2 },
  knobOn: { backgroundColor: colors.onFill, marginLeft: 20 },

  accountHero: { alignItems: 'center', gap: 12, marginBottom: 22, marginTop: 8 },
  avatarLg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgTxt: { fontSize: 24, fontWeight: '600', color: colors.inkHi },
  accountName: { fontSize: 19, fontWeight: '600', letterSpacing: -0.3, color: colors.inkHi },
  accountEmail: { fontSize: 13, color: colors.inkMid, fontFamily: fonts.mono },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20, gap: 10 },
  emptyIc: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairline2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.inkHi },
  emptyBody: { fontSize: 13, color: colors.inkLo, textAlign: 'center', lineHeight: 19, maxWidth: 250 },

  tabbar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: 'rgba(10,10,11,0.7)',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5, paddingVertical: 7 },
  tabLabel: { fontSize: 10.5, fontFamily: fonts.ui },
});
