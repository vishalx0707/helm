import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Screen from '../components/Screen';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import StatusDot from '../components/StatusDot';
import { colors, fonts, radius } from '../theme';
import { useRelay } from '../lib/connection';

/**
 * Task → Console → Result — the payoff screen. One screen, three modes driven by
 * the live task status in the relay connection:
 *   idle    -> the task input box + Run agent
 *   running -> a streaming mono console of the agent's output + Cancel
 *   done    -> a completion banner with real stats (lines / exit / elapsed)
 *   error   -> the failure reason + retry
 */
export default function TaskScreen({ route, navigation }) {
  const { projectId, projectName } = route.params || {};
  const { conn, status, agents, selectedAgentId, task } = useRelay();
  const [text, setText] = useState('');

  const agent = agents.find((a) => a.id === selectedAgentId) || agents[0] || null;
  const agentName = agent?.name || 'No agent';

  // Fresh entry resets a finished task so the input box is clean; a still-running
  // task is left alone so you can re-open it and keep watching.
  useEffect(() => {
    if (task.status === 'done' || task.status === 'error') conn.resetTask();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canRun = status === 'online' && agent && text.trim().length > 0;

  const run = () => {
    if (!canRun) return;
    conn.submitTask({
      projectId,
      projectName,
      agentId: agent.id,
      agentName,
      task: text,
    });
  };

  const startNew = () => {
    conn.resetTask();
    setText('');
  };

  const mode = task.status; // 'idle' | 'running' | 'done' | 'error'

  return (
    <Screen edges={['top']}>
      <View style={styles.head}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.crumbWrap}>
          <Feather name="chevron-left" size={18} color={colors.inkMid} />
          <Text style={styles.crumb}>
            {projectName} <Text style={styles.crumbSep}>/</Text>{' '}
            <Text style={styles.crumbStrong}>{agentName}</Text>
          </Text>
        </Pressable>
        <StatusBadge mode={mode} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {mode === 'idle' && (
          <InputMode
            text={text}
            setText={setText}
            canRun={canRun}
            onRun={run}
            status={status}
            hasAgent={!!agent}
          />
        )}
        {mode === 'running' && <RunningMode task={task} onCancel={startNew} />}
        {(mode === 'done' || mode === 'error') && (
          <ResultMode task={task} onNew={startNew} />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StatusBadge({ mode }) {
  let dot = null;
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
  } else {
    dot = <StatusDot variant="waiting" />;
  }
  return (
    <View style={styles.badge}>
      {dot}
      <Text style={styles.badgeTxt}>{label}</Text>
    </View>
  );
}

function InputMode({ text, setText, canRun, onRun, status, hasAgent }) {
  return (
    <View style={styles.pane}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="e.g. Refactor the auth module to use the new token service, and add tests for the edge cases."
        placeholderTextColor={colors.inkLo}
        multiline
        textAlignVertical="top"
        style={styles.taskbox}
      />
      <View style={styles.hint}>
        <Feather name="info" size={14} color={colors.inkLo} />
        <Text style={styles.hintTxt}>
          {status === 'online'
            ? 'The agent runs in this repo on your laptop — output streams back here.'
            : hasAgent
            ? 'Waiting for your laptop to come online before you can run.'
            : 'No agents detected on your laptop yet.'}
        </Text>
      </View>
      <Button label="Run agent" variant="fill" onPress={onRun} disabled={!canRun} />
    </View>
  );
}

function RunningMode({ task, onCancel }) {
  const scrollRef = useRef(null);
  return (
    <View style={styles.pane}>
      <View style={styles.summaryChip}>
        <Feather name="align-left" size={15} color={colors.inkLo} />
        <Text style={styles.summaryTxt} numberOfLines={2}>
          {task.text}
        </Text>
      </View>
      <View style={styles.console}>
        <View style={styles.consoleEdge} />
        <ScrollView
          ref={scrollRef}
          style={styles.consoleLines}
          contentContainerStyle={{ padding: 14 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        >
          <ConsoleText lines={task.lines} live />
        </ScrollView>
      </View>
      <Button label="Cancel task" variant="ghost" onPress={onCancel} style={{ marginTop: 13 }} />
    </View>
  );
}

function ResultMode({ task, onNew }) {
  const isError = task.status === 'error';
  const elapsed = formatElapsed(task.startedAt, task.endedAt);
  const lineCount = task.lines.reduce(
    (n, l) => n + (l.chunk.match(/\n/g)?.length || 0),
    0
  );

  return (
    <View style={styles.pane}>
      <View style={styles.banner}>
        <View style={[styles.check, isError && styles.checkError]}>
          <Feather
            name={isError ? 'x' : 'check'}
            size={28}
            color={isError ? colors.inkHi : colors.onFill}
          />
        </View>
        <Text style={styles.bannerTitle}>{isError ? 'Task failed' : 'Task completed'}</Text>
        <Text style={styles.bannerSub}>
          {isError
            ? task.message || 'The agent reported an error.'
            : `${task.agentName} finished in ${task.projectName}.`}
        </Text>
      </View>

      {!isError && (
        <View style={styles.stats}>
          <Stat num={String(lineCount)} label="lines" />
          <Stat num={task.code === 0 ? '0' : String(task.code)} label="exit" />
          <Stat num={elapsed} label="elapsed" />
        </View>
      )}

      {/* keep the output reviewable after completion */}
      <View style={[styles.console, { flex: 1 }]}>
        <ScrollView
          style={styles.consoleLines}
          contentContainerStyle={{ padding: 14 }}
          showsVerticalScrollIndicator={false}
        >
          <ConsoleText lines={task.lines} />
        </ScrollView>
      </View>

      <Button label="Start new task" variant="fill" onPress={onNew} style={{ marginTop: 16 }} />
    </View>
  );
}

function ConsoleText({ lines, live }) {
  if (!lines.length) {
    return <Text style={styles.clineMut}>{live ? 'Starting agent…' : '(no output)'}</Text>;
  }
  return (
    <Text style={styles.cline}>
      {lines.map((l, i) => (
        <Text key={i} style={l.stream === 'stderr' ? styles.clineErr : styles.cline}>
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

  pane: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },

  taskbox: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.hairline2,
    borderRadius: radius.card,
    padding: 16,
    fontSize: 15,
    lineHeight: 22,
    color: colors.inkHi,
    minHeight: 150,
  },
  hint: { flexDirection: 'row', gap: 8, marginVertical: 14, paddingHorizontal: 2 },
  hintTxt: { fontSize: 12, color: colors.inkLo, flex: 1, lineHeight: 17 },

  summaryChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  summaryTxt: { fontSize: 13, color: colors.inkMid, flex: 1, lineHeight: 18 },

  console: {
    flex: 1,
    backgroundColor: colors.consoleBg,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
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
  consoleLines: { flex: 1 },
  cline: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 19, color: colors.inkMid },
  clineErr: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 19, color: colors.inkHi },
  clineMut: { fontFamily: fonts.mono, fontSize: 11.5, lineHeight: 19, color: colors.inkLo },

  banner: { alignItems: 'center', gap: 11, paddingTop: 20, paddingBottom: 18 },
  check: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkError: { backgroundColor: 'transparent', borderWidth: 2, borderColor: colors.hairline2 },
  bannerTitle: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3, color: colors.inkHi },
  bannerSub: { fontSize: 13, color: colors.inkMid, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 },

  stats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
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
});
