import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Spinner from '../components/Spinner';
import StatusDot from '../components/StatusDot';
import { colors, fonts, radius } from '../theme';
import { useRelay } from '../lib/connection';

/**
 * Task — the conversational payoff screen from helm-mobile-prototype (Screen 4).
 * A single thread driven by the live task status in the relay connection, with a
 * sticky chat composer at the bottom:
 *
 *   idle    -> centered hint, composer ready
 *   running -> user message bubble + agent label + embedded live console
 *   done    -> bubble + collapsible log + result card + stats, ready for follow-up
 *   error   -> bubble + error result card
 *
 * Each send is one independent run (the MVP protocol has no multi-turn session),
 * so "reply" simply submits a new task in the same project + agent. No backend
 * change — this drives the existing RelayConnection.
 */
export default function TaskScreen({ route, navigation }) {
  const { conn, status, projects, agents, selectedAgentId, task } = useRelay();

  const [projectId, setProjectId] = useState(
    route.params?.projectId || projects[0]?.id || null
  );
  const [text, setText] = useState('');
  const [inputH, setInputH] = useState(40);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const threadRef = useRef(null);

  // Clean entry: a finished task resets to the empty input; a still-running task
  // is left intact so re-opening keeps the live stream.
  useEffect(() => {
    if (task.status === 'done' || task.status === 'error') conn.resetTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const project = useMemo(
    () =>
      projects.find((p) => p.id === projectId) || {
        id: projectId || route.params?.projectId,
        name: route.params?.projectName || 'Project',
      },
    [projects, projectId, route.params]
  );
  const agent = agents.find((a) => a.id === selectedAgentId) || agents[0] || null;
  const agentName = agent?.name || 'No agent';

  const mode = task.status; // 'idle' | 'running' | 'done' | 'error'
  const canSend =
    status === 'online' && !!agent && !!project?.id && text.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    conn.submitTask({
      projectId: project.id,
      projectName: project.name,
      agentId: agent.id,
      agentName,
      task: text,
    });
    setText('');
    setInputH(40);
    setLogOpen(false);
  };

  const startNew = () => {
    conn.resetTask();
    setText('');
    setInputH(40);
    setLogOpen(false);
  };

  const placeholder =
    mode === 'done' || mode === 'error'
      ? `Reply to ${agentName}…`
      : `Message ${agentName}…`;

  return (
    <Screen edges={['top']}>
      {/* header */}
      <View style={styles.head}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.crumbWrap}
        >
          <Feather name="chevron-left" size={18} color={colors.inkMid} />
          <Text style={styles.crumb} numberOfLines={1}>
            {project.name} <Text style={styles.crumbSep}>/</Text>{' '}
            <Text style={styles.crumbStrong}>{agentName}</Text>
          </Text>
        </Pressable>
        <StatusBadge mode={mode} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* thread */}
        <ScrollView
          ref={threadRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          onContentSizeChange={() =>
            threadRef.current?.scrollToEnd({ animated: true })
          }
          showsVerticalScrollIndicator={false}
        >
          {mode === 'idle' && <InputHint projectName={project.name} agentName={agentName} />}

          {mode !== 'idle' && (
            <>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleTxt}>{task.text}</Text>
              </View>
              <AgentLabel agentName={agentName} working={mode === 'running'} />
            </>
          )}

          {mode === 'running' && <LiveConsole lines={task.lines} />}

          {(mode === 'done' || mode === 'error') && (
            <ResultBlock
              task={task}
              logOpen={logOpen}
              onToggleLog={() => setLogOpen((v) => !v)}
              onNew={startNew}
            />
          )}
        </ScrollView>

        {/* composer */}
        <View style={styles.composer}>
          <Pressable
            style={styles.plus}
            onPress={() => setSheetOpen(true)}
            hitSlop={6}
            accessibilityLabel="Spawn agent"
          >
            <Feather name="plus" size={18} color={colors.inkMid} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.inkLo}
            multiline
            onContentSizeChange={(e) =>
              setInputH(Math.min(96, Math.max(40, e.nativeEvent.contentSize.height)))
            }
            style={[styles.field, { height: inputH }]}
          />
          <Pressable
            style={[styles.send, !canSend && styles.sendDisabled]}
            onPress={send}
            disabled={!canSend}
            hitSlop={6}
            accessibilityLabel="Send"
          >
            <Feather name="arrow-up" size={18} color={colors.onFill} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SpawnSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        projects={projects}
        agents={agents}
        projectId={project.id}
        agentId={agent?.id}
        onPickProject={setProjectId}
        onPickAgent={(id) => conn.selectAgent(id)}
      />
    </Screen>
  );
}

function StatusBadge({ mode }) {
  let dot = <StatusDot variant="waiting" />;
  let label = 'Ready';
  if (mode === 'running') {
    dot = <Spinner size={14} />;
    label = 'Running';
  } else if (mode === 'done') {
    dot = <Feather name="check" size={13} color={colors.inkHi} />;
    label = 'Done';
  } else if (mode === 'error') {
    dot = <Feather name="alert-circle" size={13} color={colors.inkHi} />;
    label = 'Error';
  }
  return (
    <View style={styles.badge}>
      {dot}
      <Text style={styles.badgeTxt}>{label}</Text>
    </View>
  );
}

function InputHint({ projectName, agentName }) {
  return (
    <View style={styles.hintWrap}>
      <View style={styles.hintGlyph}>
        <Feather name="message-circle" size={21} color={colors.inkMid} />
      </View>
      <Text style={styles.hintTxt}>
        Message <Text style={styles.hintStrong}>{agentName}</Text> to spawn it in{' '}
        <Text style={styles.hintStrong}>{projectName}</Text>. Its work streams back
        here as it runs.
      </Text>
    </View>
  );
}

function AgentLabel({ agentName, working }) {
  return (
    <View style={styles.agentLabel}>
      <View style={styles.agentAv}>
        <Text style={styles.agentAvTxt}>✦</Text>
      </View>
      <Text style={styles.agentLabelTxt}>
        {agentName}
        {working ? ' · working' : ''}
      </Text>
    </View>
  );
}

function LiveConsole({ lines }) {
  const ref = useRef(null);
  return (
    <View style={styles.consoleEmbed}>
      <View style={styles.consoleEdge} />
      <View style={styles.ehead}>
        <Text style={styles.eheadTxt}>console · live</Text>
        <Spinner size={11} />
      </View>
      <ScrollView
        ref={ref}
        style={styles.consoleLines}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <ConsoleText lines={lines} live />
      </ScrollView>
    </View>
  );
}

function ResultBlock({ task, logOpen, onToggleLog, onNew }) {
  const isError = task.status === 'error';
  const elapsed = formatElapsed(task.startedAt, task.endedAt);
  const lineCount = task.lines.reduce(
    (n, l) => n + (l.chunk.match(/\n/g)?.length || 0),
    0
  );

  return (
    <>
      {/* collapsible log */}
      <Pressable style={styles.disclose} onPress={onToggleLog}>
        <Feather name={logOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.inkLo} />
        <Text style={styles.discloseTxt}>{lineCount} log lines</Text>
      </Pressable>
      {logOpen && (
        <View style={styles.consoleEmbed}>
          <ScrollView
            style={styles.consoleLines}
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <ConsoleText lines={task.lines} />
          </ScrollView>
        </View>
      )}

      {/* result card */}
      <View style={styles.result}>
        <View style={[styles.resultChk, isError && styles.resultChkError]}>
          <Feather
            name={isError ? 'x' : 'check'}
            size={16}
            color={isError ? colors.inkHi : colors.onFill}
          />
        </View>
        <View style={styles.resultMeta}>
          <Text style={styles.resultT}>{isError ? 'Task failed' : 'Task completed'}</Text>
          <Text style={styles.resultS} numberOfLines={2}>
            {isError
              ? task.message || 'the agent reported an error'
              : `finished in the ${task.projectName} repo`}
          </Text>
        </View>
      </View>

      {/* stats — real data only: lines / exit / elapsed */}
      {!isError && (
        <View style={styles.stats}>
          <CountStat to={lineCount} label="lines" />
          <Stat num={task.code === 0 ? '0' : String(task.code ?? '—')} label="exit" />
          <Stat num={elapsed} label="elapsed" />
        </View>
      )}

      <Pressable style={styles.newtaskWrap} onPress={onNew}>
        <Text style={styles.newtask}>Start a new task</Text>
      </Pressable>
    </>
  );
}

function ConsoleText({ lines, live }) {
  if (!lines.length) {
    return <Text style={styles.clineMut}>{live ? 'Starting agent…' : '(no output)'}</Text>;
  }
  return (
    <Text style={styles.cline}>
      {lines.map((l, i) => (
        <Text key={i} style={l.stream === 'stderr' ? styles.clineHi : styles.cline}>
          {l.chunk}
        </Text>
      ))}
    </Text>
  );
}

function Stat({ num, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

function CountStat({ to, label }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const dur = 650;
    let raf;
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      setN(Math.round(p * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <Stat num={String(n)} label={label} />;
}

function SpawnSheet({
  visible,
  onClose,
  projects,
  agents,
  projectId,
  agentId,
  onPickProject,
  onPickAgent,
}) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <Pressable onPress={() => {}}>
            <View style={styles.grip} />
            <Text style={styles.sheetTitle}>Spawn an agent</Text>
            <Text style={styles.sheetSub}>runs on your laptop, in the chosen repo</Text>

            <Text style={styles.sheetGroup}>PROJECT</Text>
            <View style={styles.sheetList}>
              {projects.length === 0 && (
                <Text style={styles.sheetEmpty}>No projects authorized on the laptop.</Text>
              )}
              {projects.map((p) => (
                <SheetOption
                  key={p.id}
                  label={p.name}
                  selected={p.id === projectId}
                  onPress={() => onPickProject(p.id)}
                />
              ))}
            </View>

            <Text style={styles.sheetGroup}>AGENT</Text>
            <View style={styles.sheetList}>
              {agents.length === 0 && (
                <Text style={styles.sheetEmpty}>No agents detected on the laptop.</Text>
              )}
              {agents.map((a) => (
                <SheetOption
                  key={a.id}
                  label={a.name}
                  selected={a.id === agentId}
                  onPress={() => onPickAgent(a.id)}
                />
              ))}
            </View>

            <Pressable style={styles.startbtn} onPress={onClose}>
              <Feather name="message-circle" size={16} color={colors.onFill} />
              <Text style={styles.startbtnTxt}>Start conversation</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function SheetOption({ label, selected, onPress }) {
  return (
    <Pressable
      style={[styles.sheetOpt, selected && styles.sheetOptSel]}
      onPress={onPress}
    >
      <Text style={[styles.sheetOptTxt, selected && styles.sheetOptTxtSel]} numberOfLines={1}>
        {label}
      </Text>
      {selected && <Feather name="check" size={16} color={colors.inkHi} />}
    </Pressable>
  );
}

function formatElapsed(start, end) {
  if (!start || !end) return '—';
  const s = Math.max(0, Math.round((end - start) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  crumbWrap: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  crumb: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMid, flexShrink: 1 },
  crumbSep: { color: colors.inkLo },
  crumbStrong: { color: colors.inkHi },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  badgeTxt: { fontSize: 11.5, fontFamily: fonts.mono, color: colors.inkMid },

  // thread
  thread: { flex: 1 },
  threadContent: { padding: 16, gap: 13, flexGrow: 1 },

  hintWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
    paddingHorizontal: 24,
  },
  hintGlyph: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairline2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTxt: { textAlign: 'center', color: colors.inkLo, fontSize: 12.5, lineHeight: 20, maxWidth: 232 },
  hintStrong: { color: colors.inkMid, fontWeight: '500' },

  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '84%',
    backgroundColor: colors.fill,
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderBottomRightRadius: 5,
  },
  userBubbleTxt: { color: colors.onFill, fontSize: 13.5, lineHeight: 20, fontWeight: '500' },

  agentLabel: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  agentAv: {
    width: 18,
    height: 18,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentAvTxt: { fontSize: 9, color: colors.inkMid },
  agentLabelTxt: {
    fontFamily: fonts.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    color: colors.inkLo,
    textTransform: 'uppercase',
  },

  consoleEmbed: {
    alignSelf: 'stretch',
    backgroundColor: colors.consoleBg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
    minHeight: 160,
    maxHeight: 360,
  },
  consoleEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.hairline2,
    zIndex: 5,
  },
  ehead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  eheadTxt: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkLo,
  },
  consoleLines: { flexGrow: 0 },
  cline: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 19, color: colors.inkMid },
  clineHi: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 19, color: colors.inkHi },
  clineMut: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 19, color: colors.inkLo },

  disclose: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  discloseTxt: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkLo },

  result: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline2,
    borderRadius: 14,
    padding: 13,
  },
  resultChk: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultChkError: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.hairline2 },
  resultMeta: { flex: 1, minWidth: 0 },
  resultT: { fontSize: 13, fontWeight: '600', letterSpacing: -0.1, color: colors.inkHi },
  resultS: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkLo, marginTop: 3 },

  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statNum: { fontFamily: fonts.mono, fontSize: 21, fontWeight: '500', letterSpacing: -0.3, color: colors.inkHi },
  statLbl: { fontSize: 9.5, color: colors.inkLo, textTransform: 'uppercase', letterSpacing: 0.9, marginTop: 5 },

  newtaskWrap: { alignSelf: 'center', paddingVertical: 4 },
  newtask: {
    fontFamily: fonts.mono,
    fontSize: 11.5,
    color: colors.inkMid,
    textDecorationLine: 'underline',
  },

  // composer
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: Platform.OS === 'ios' ? 24 : 11,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    backgroundColor: colors.bg,
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    flex: 1,
    minHeight: 40,
    maxHeight: 96,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline2,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 13.5,
    color: colors.inkHi,
    fontFamily: fonts.ui,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },

  // spawn sheet
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.hairline2,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  grip: { width: 38, height: 4, borderRadius: 99, backgroundColor: colors.hairline2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3, color: colors.inkHi },
  sheetSub: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkLo, marginTop: 3, marginBottom: 16 },
  sheetGroup: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.inkLo,
    marginBottom: 8,
  },
  sheetList: { gap: 8, marginBottom: 16 },
  sheetEmpty: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkLo, paddingVertical: 8 },
  sheetOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 11,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.input,
    paddingVertical: 12,
    paddingHorizontal: 13,
  },
  sheetOptSel: { borderColor: colors.inkHi, backgroundColor: '#1a1a1e' },
  sheetOptTxt: { fontSize: 13.5, color: colors.inkMid, fontWeight: '500', flexShrink: 1 },
  sheetOptTxtSel: { color: colors.inkHi },
  startbtn: {
    height: 50,
    borderRadius: radius.input,
    backgroundColor: colors.fill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  startbtnTxt: { fontSize: 14.5, fontWeight: '600', color: colors.onFill, fontFamily: fonts.ui },
});
