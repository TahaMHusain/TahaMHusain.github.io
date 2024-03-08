// Adapted from github.com/dmotz/trystero
import Peer from "./simple-peer-light.js";

// From src/utils.js
const charSet = '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz'

const initPeer = (initiator, trickle, config) => {
    const peer = new Peer({initiator, trickle, config})
    const onData = data => peer.__earlyDataBuffer.push(data)
  
    peer.on(events.data, onData)
    peer.__earlyDataBuffer = []
    peer.__drainEarlyData = f => {
      peer.off(events.data, onData)
      peer.__earlyDataBuffer.forEach(f)
      delete peer.__earlyDataBuffer
      delete peer.__drainEarlyData
    }
  
    return peer
}

const genId = n => {
  return Array(n)
    .fill()
    .map(() => charSet[Math.floor(Math.random() * charSet.length)])
    .join('')
}

const initGuard = (occupiedRooms, f) => (config, ns) => {
    if (occupiedRooms[ns]) {
      return occupiedRooms[ns]
    }
  
    if (!config) {
      throw mkErr('requires a config map as the first argument')
    }
  
    if (!config.appId && !config.firebaseApp) {
      throw mkErr('config map is missing appId field')
    }
  
    if (!ns) {
      throw mkErr('namespace argument required')
    }
  
    return (occupiedRooms[ns] = f(config, ns))
}

const libName = 'Trystero'
const selfId = genId(20)
console.log("In trystero-torrent: selfId is " + selfId)
const {keys, values, entries, fromEntries} = Object
const noOp = () => {}
const mkErr = msg => new Error(`${libName}: ${msg}`)
const encodeBytes = txt => new TextEncoder().encode(txt)
const decodeBytes = buffer => new TextDecoder().decode(buffer)

const events = fromEntries(
    ['close', 'connect', 'data', 'error', 'signal', 'stream', 'track'].map(k => [
      k,
      k
    ])
)

const getRelays = (config, defaults, defaultN) =>
  (config.relayUrls || defaults).slice(
    0,
    config.relayUrls
      ? config.relayUrls.length
      : config.relayRedundancy || defaultN
)

const sleep = ms => new Promise(res => setTimeout(res, ms))

// From src/room.js
const TypedArray = Object.getPrototypeOf(Uint8Array)
const typeByteLimit = 12
const typeIndex = 0
const nonceIndex = typeIndex + typeByteLimit
const tagIndex = nonceIndex + 1
const progressIndex = tagIndex + 1
const payloadIndex = progressIndex + 1
const chunkSize = 16369
const oneByteMax = 255
const buffLowEvent = 'bufferedamountlow'

var room = (onPeer, onSelfLeave) => {
  const peerMap = {}
  const actions = {}
  const pendingTransmissions = {}
  const pendingPongs = {}
  const pendingStreamMetas = {}
  const pendingTrackMetas = {}

  const iterate = (targets, f) =>
    (targets
      ? Array.isArray(targets)
        ? targets
        : [targets]
      : keys(peerMap)
    ).flatMap(id => {
      const peer = peerMap[id]

      if (!peer) {
        console.warn(`${libName}: no peer with id ${id} found`)
        return []
      }

      return f(id, peer)
    })

  const exitPeer = id => {
    if (!peerMap[id]) {
      return
    }

    delete peerMap[id]
    delete pendingTransmissions[id]
    delete pendingPongs[id]
    onPeerLeave(id)
  }

  const makeAction = type => {
    if (actions[type]) {
      return [
        actions[type].send,
        actions[type].setOnComplete,
        actions[type].setOnProgress
      ]
    }

    if (!type) {
      throw mkErr('action type argument is required')
    }

    const typeBytes = encodeBytes(type)

    if (typeBytes.byteLength > typeByteLimit) {
      throw mkErr(
        `action type string "${type}" (${typeBytes.byteLength}b) exceeds ` +
          `byte limit (${typeByteLimit}). Hint: choose a shorter name.`
      )
    }

    const typeBytesPadded = new Uint8Array(typeByteLimit)
    typeBytesPadded.set(typeBytes)

    let nonce = 0

    actions[type] = {
      onComplete: noOp,
      onProgress: noOp,

      setOnComplete: f => (actions[type] = {...actions[type], onComplete: f}),

      setOnProgress: f => (actions[type] = {...actions[type], onProgress: f}),

      send: async (data, targets, meta, onProgress) => {
        if (meta && typeof meta !== 'object') {
          throw mkErr('action meta argument must be an object')
        }

        if (data === undefined) {
          throw mkErr('action data cannot be undefined')
        }

        const isJson = typeof data !== 'string'
        const isBlob = data instanceof Blob
        const isBinary =
          isBlob || data instanceof ArrayBuffer || data instanceof TypedArray

        if (meta && !isBinary) {
          throw mkErr('action meta argument can only be used with binary data')
        }

        const buffer = isBinary
          ? new Uint8Array(isBlob ? await data.arrayBuffer() : data)
          : encodeBytes(isJson ? JSON.stringify(data) : data)

        const metaEncoded = meta ? encodeBytes(JSON.stringify(meta)) : null

        const chunkTotal =
          Math.ceil(buffer.byteLength / chunkSize) + (meta ? 1 : 0) || 1

        const chunks = Array(chunkTotal)
          .fill()
          .map((_, i) => {
            const isLast = i === chunkTotal - 1
            const isMeta = meta && i === 0
            const chunk = new Uint8Array(
              payloadIndex +
                (isMeta
                  ? metaEncoded.byteLength
                  : isLast
                    ? buffer.byteLength -
                      chunkSize * (chunkTotal - (meta ? 2 : 1))
                    : chunkSize)
            )

            chunk.set(typeBytesPadded)
            chunk.set([nonce], nonceIndex)
            chunk.set(
              [isLast | (isMeta << 1) | (isBinary << 2) | (isJson << 3)],
              tagIndex
            )
            chunk.set(
              [Math.round(((i + 1) / chunkTotal) * oneByteMax)],
              progressIndex
            )
            chunk.set(
              meta
                ? isMeta
                  ? metaEncoded
                  : buffer.subarray((i - 1) * chunkSize, i * chunkSize)
                : buffer.subarray(i * chunkSize, (i + 1) * chunkSize),
              payloadIndex
            )

            return chunk
          })

        nonce = (nonce + 1) & oneByteMax

        return Promise.all(
          iterate(targets, async (id, peer) => {
            const chan = peer._channel
            let chunkN = 0

            while (chunkN < chunkTotal) {
              const chunk = chunks[chunkN]

              if (chan.bufferedAmount > chan.bufferedAmountLowThreshold) {
                await new Promise(res => {
                  const next = () => {
                    chan.removeEventListener(buffLowEvent, next)
                    res()
                  }

                  chan.addEventListener(buffLowEvent, next)
                })
              }

              if (!peerMap[id]) {
                break
              }

              peer.send(chunk)
              chunkN++

              if (onProgress) {
                onProgress(chunk[progressIndex] / oneByteMax, id, meta)
              }
            }
          })
        )
      }
    }

    return [
      actions[type].send,
      actions[type].setOnComplete,
      actions[type].setOnProgress
    ]
  }

  const handleData = (id, data) => {
    const buffer = new Uint8Array(data)
    const type = decodeBytes(buffer.subarray(typeIndex, nonceIndex)).replaceAll(
      '\x00',
      ''
    )
    const [nonce] = buffer.subarray(nonceIndex, tagIndex)
    const [tag] = buffer.subarray(tagIndex, progressIndex)
    const [progress] = buffer.subarray(progressIndex, payloadIndex)
    const payload = buffer.subarray(payloadIndex)
    const isLast = !!(tag & 1)
    const isMeta = !!(tag & (1 << 1))
    const isBinary = !!(tag & (1 << 2))
    const isJson = !!(tag & (1 << 3))

    if (!actions[type]) {
      throw mkErr(`received message with unregistered type (${type})`)
    }

    if (!pendingTransmissions[id]) {
      pendingTransmissions[id] = {}
    }

    if (!pendingTransmissions[id][type]) {
      pendingTransmissions[id][type] = {}
    }

    let target = pendingTransmissions[id][type][nonce]

    if (!target) {
      target = pendingTransmissions[id][type][nonce] = {chunks: []}
    }

    if (isMeta) {
      target.meta = JSON.parse(decodeBytes(payload))
    } else {
      target.chunks.push(payload)
    }

    actions[type].onProgress(progronCompleteess / oneByteMax, id, target.meta)

    if (!isLast) {
      return
    }

    const full = new Uint8Array(
      target.chunks.reduce((a, c) => a + c.byteLength, 0)
    )

    target.chunks.reduce((a, c) => {
      full.set(c, a)
      return a + c.byteLength
    }, 0)

    if (isBinary) {
      actions[type].onComplete(full, id, target.meta)
    } else {
      const text = decodeBytes(full)
      actions[type].onComplete(isJson ? JSON.parse(text) : text, id)
    }

    delete pendingTransmissions[id][type][nonce]
  }

  const [sendPing, getPing] = makeAction('__91n6__')
  const [sendPong, getPong] = makeAction('__90n6__')
  const [sendSignal, getSignal] = makeAction('__516n4L__')
  const [sendStreamMeta, getStreamMeta] = makeAction('__57r34m__')
  const [sendTrackMeta, getTrackMeta] = makeAction('__7r4ck__')

  let onPeerJoin = noOp
  let onPeerLeave = noOp
  let onPeerStream = noOp
  let onPeerTrack = noOp

  onPeer((peer, id) => {
    if (peerMap[id]) {
      return
    }

    const onData = handleData.bind(null, id)

    peerMap[id] = peer

    peer.on(events.signal, sdp => sendSignal(sdp, id))
    peer.on(events.close, () => exitPeer(id))
    peer.on(events.data, onData)

    peer.on(events.stream, stream => {
      onPeerStream(stream, id, pendingStreamMetas[id])
      delete pendingStreamMetas[id]
    })

    peer.on(events.track, (track, stream) => {
      onPeerTrack(track, stream, id, pendingTrackMetas[id])
      delete pendingTrackMetas[id]
    })

    peer.on(events.error, e => {
      if (e.code === 'ERR_DATA_CHANNEL') {
        return
      }
      console.error(e)
    })

    onPeerJoin(id)
    peer.__drainEarlyData(onData)
  })

  getPing((_, id) => sendPong('', id))

  getPong((_, id) => {
    if (pendingPongs[id]) {
      pendingPongs[id]()
      delete pendingPongs[id]
    }
  })

  getSignal((sdp, id) => {
    if (peerMap[id]) {
      peerMap[id].signal(sdp)
    }
  })

  getStreamMeta((meta, id) => (pendingStreamMetas[id] = meta))

  getTrackMeta((meta, id) => (pendingTrackMetas[id] = meta))

  return {
    makeAction,

    ping: async id => {
      if (!id) {
        throw mkErr('ping() must be called with target peer ID')
      }

      const start = Date.now()

      sendPing('', id)
      await new Promise(res => (pendingPongs[id] = res))
      return Date.now() - start
    },

    leave: () => {
      entries(peerMap).forEach(([id, peer]) => {
        peer.destroy()
        delete peerMap[id]
      })
      onSelfLeave()
    },

    getPeers: () =>
      fromEntries(entries(peerMap).map(([id, peer]) => [id, peer._pc])),

    addStream: (stream, targets, meta) =>
      iterate(targets, async (id, peer) => {
        if (meta) {
          await sendStreamMeta(meta, id)
        }

        peer.addStream(stream)
      }),

    removeStream: (stream, targets) =>
      iterate(targets, (_, peer) => peer.removeStream(stream)),

    addTrack: (track, stream, targets, meta) =>
      iterate(targets, async (id, peer) => {
        if (meta) {
          await sendTrackMeta(meta, id)
        }

        peer.addTrack(track, stream)
      }),

    removeTrack: (track, stream, targets) =>
      iterate(targets, (_, peer) => peer.removeTrack(track, stream)),

    replaceTrack: (oldTrack, newTrack, stream, targets, meta) =>
      iterate(targets, async (id, peer) => {
        if (meta) {
          await sendTrackMeta(meta, id)
        }

        peer.replaceTrack(oldTrack, newTrack, stream)
      }),

    onPeerJoin: f => (onPeerJoin = f),

    onPeerLeave: f => (onPeerLeave = f),

    onPeerStream: f => (onPeerStream = f),

    onPeerTrack: f => (onPeerTrack = f)
  }
}

// From src/crypto.js
const algo = 'AES-CBC'

const unpack = packed => {
    const str = atob(packed)
  
    return new Uint8Array(str.length).map((_, i) => str.charCodeAt(i)).buffer
}

export const genKey = async (secret, ns) => {
  crypto.subtle.importKey(
    'raw',
    await crypto.subtle.digest(
      {name: 'SHA-256'},
      encodeBytes(`${secret}:${ns}`)
    ),
    {name: algo},
    false,
    ['encrypt', 'decrypt']
)}

const encrypt = async (keyP, plaintext) => {
    const iv = crypto.getRandomValues(new Uint8Array(16))
  
    return JSON.stringify({
      c: pack(
        await crypto.subtle.encrypt(
          {name: algo, iv},
          await keyP,
          encodeBytes(plaintext)
        )
      ),
      iv: [...iv]
    })
}

const decrypt = async (keyP, raw) => {
    const {c, iv} = JSON.parse(raw)
  
    return decodeBytes(
      await crypto.subtle.decrypt(
        {name: algo, iv: new Uint8Array(iv)},
        await keyP,
        unpack(c)
      )
    )
}

// From src/torrent.js
const occupiedRooms = {}
const socketPromises = {}
const sockets = {}
const socketRetryTimeouts = {}
const socketListeners = {}
const hashLimit = 20
const offerPoolSize = 10
const defaultRedundancy = 3
const defaultAnnounceSecs = 33
const maxAnnounceSecs = 120
const trackerRetrySecs = 4
const trackerAction = 'announce'
const defaultRelayUrls = [
  'wss://tracker.webtorrent.dev',
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.btorrent.xyz'
]

const joinRoom = initGuard(occupiedRooms, (config, ns) => {
    if (config.trackerUrls || config.trackerRedundancy) {
      throw mkErr(
        'trackerUrls/trackerRedundancy have been replaced by relayUrls/relayRedundancy'
      )
    }
  
    const connectedPeers = {}
    const key = config.password && genKey(config.password, ns)
    const relayUrls = getRelays(config, defaultRelayUrls, defaultRedundancy)
  
    const infoHashP = crypto.subtle
      .digest('SHA-1', encodeBytes(`${libName}:${config.appId}:${ns}`))
      .then(buffer =>
        Array.from(new Uint8Array(buffer))
          .map(b => b.toString(36))
          .join('')
          .slice(0, hashLimit)
      )
  
    const makeOffers = howMany =>
      fromEntries(
        Array(howMany)
          .fill()
          .map(() => {
            const peer = initPeer(true, false, config.rtcConfig)
  
            return [
              genId(hashLimit),
              {peer, offerP: new Promise(res => peer.once(events.signal, res))}
            ]
          })
      )
  
    const onSocketMessage = async (socket, e) => {
      const infoHash = await infoHashP
      let val
  
      try {
        val = JSON.parse(e.data)
      } catch (e) {
        console.error(`${libName}: received malformed SDP JSON`)
        return
      }
  
      if (val.info_hash !== infoHash || (val.peer_id && val.peer_id === selfId)) {
        return
      }
  
      const errMsg = val['failure reason']
  
      if (errMsg) {
        console.warn(
          `${libName}: torrent tracker failure from ${socket.url} - ${errMsg}`
        )
        return
      }
  
      if (
        val.interval &&
        val.interval > announceSecs &&
        val.interval <= maxAnnounceSecs
      ) {
        clearInterval(announceInterval)
        announceSecs = val.interval
        announceInterval = setInterval(announceAll, announceSecs * 1000)
      }
  
      if (val.offer && val.offer_id) {
        if (connectedPeers[val.peer_id] || handledOffers[val.offer_id]) {
          return
        }
  
        handledOffers[val.offer_id] = true
  
        const peer = initPeer(false, false, config.rtcConfig)
  
        peer.once(events.signal, async answer =>
          socket.send(
            JSON.stringify({
              answer: key
                ? {...answer, sdp: await encrypt(key, answer.sdp)}
                : answer,
              action: trackerAction,
              info_hash: infoHash,
              peer_id: selfId,
              to_peer_id: val.peer_id,
              offer_id: val.offer_id
            })
          )
        )
        peer.on(events.connect, () => onConnect(peer, val.peer_id))
        peer.on(events.close, () => onDisconnect(peer, val.peer_id, val.offer_id))
        peer.signal(
          key ? {...val.offer, sdp: await decrypt(key, val.offer.sdp)} : val.offer
        )
  
        return
      }
  
      if (val.answer) {
        if (connectedPeers[val.peer_id] || handledOffers[val.offer_id]) {
          return
        }
  
        const offer = offerPool[val.offer_id]
  
        if (offer) {
          const {peer} = offer
  
          if (peer.destroyed) {
            return
          }
  
          handledOffers[val.offer_id] = true
          peer.on(events.connect, () =>
            onConnect(peer, val.peer_id, val.offer_id)
          )
          peer.on(events.close, () =>
            onDisconnect(peer, val.peer_id, val.offer_id)
          )
          peer.signal(
            key
              ? {...val.answer, sdp: await decrypt(key, val.answer.sdp)}
              : val.answer
          )
        }
      }
    }
  
    const announce = async (socket, infoHash) =>
      socket.send(
        JSON.stringify({
          action: trackerAction,
          info_hash: infoHash,
          numwant: offerPoolSize,
          peer_id: selfId,
          offers: await Promise.all(
            entries(offerPool).map(async ([id, {offerP}]) => {
              const offer = await offerP
  
              return {
                offer_id: id,
                offer: key
                  ? {...offer, sdp: await encrypt(key, offer.sdp)}
                  : offer
              }
            })
          )
        })
      )
  
    const makeSocket = (url, infoHash, forced) => {
      if (forced || !socketPromises[url]) {
        socketListeners[url] = {
          ...socketListeners[url],
          [infoHash]: onSocketMessage
        }
        socketPromises[url] = new Promise(res => {
          const socket = new WebSocket(url)
          sockets[url] = socket
  
          socket.addEventListener('open', () => {
            // Reset the retry timeout for this tracker
            socketRetryTimeouts[url] = trackerRetrySecs * 1000
            res(socket)
          })
  
          socket.addEventListener('message', e =>
            values(socketListeners[url]).forEach(f => f(socket, e))
          )
  
          socket.addEventListener('close', async () => {
            socketRetryTimeouts[url] =
              socketRetryTimeouts[url] ?? trackerRetrySecs * 1000
  
            await sleep(socketRetryTimeouts[url])
            socketRetryTimeouts[url] *= 2
  
            makeSocket(url, infoHash, true)
          })
        })
      } else {
        socketListeners[url][infoHash] = onSocketMessage
      }
  
      return socketPromises[url]
    }
  
    const announceAll = async () => {
      const infoHash = await infoHashP
  
      if (offerPool) {
        cleanPool()
      }
  
      offerPool = makeOffers(offerPoolSize)
  
      relayUrls.forEach(async url => {
        const socket = await makeSocket(url, infoHash)
  
        if (socket.readyState === WebSocket.OPEN) {
          announce(socket, infoHash)
        } else if (socket.readyState !== WebSocket.CONNECTING) {
          announce(await makeSocket(url, infoHash, true), infoHash)
        }
      })
    }
  
    const cleanPool = () => {
      entries(offerPool).forEach(([id, {peer}]) => {
        if (!handledOffers[id] && !connectedPeers[id]) {
          peer.destroy()
        }
      })
  
      handledOffers = {}
    }
  
    const onConnect = (peer, id, offerId) => {
      onPeerConnect(peer, id)
      connectedPeers[id] = true
  
      if (offerId) {
        connectedPeers[offerId] = true
      }
    }
  
    const onDisconnect = (peer, peerId, offerId) => {
      delete connectedPeers[peerId]
      peer.destroy()
  
      const isInOfferPool = offerId in offerPool
  
      if (isInOfferPool) {
        delete offerPool[offerId]
        offerPool = {...offerPool, ...makeOffers(1)}
      }
    }
  
    let announceSecs = defaultAnnounceSecs
    let announceInterval = setInterval(announceAll, announceSecs * 1000)
    let onPeerConnect = noOp
    let handledOffers = {}
    let offerPool
  
    announceAll()
  
    return room(
      f => (onPeerConnect = f),
      async () => {
        const infoHash = await infoHashP
  
        relayUrls.forEach(url => delete socketListeners[url][infoHash])
        delete occupiedRooms[ns]
        clearInterval(announceInterval)
        cleanPool()
      }
    )
})

const getRelaySockets = () => ({...sockets})

// Export statement
export {
    getRelaySockets,
    joinRoom,
    selfId
}