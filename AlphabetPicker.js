import React, { Component } from 'react'
import { View, PanResponder } from 'react-native'
import { AlphabetLetter } from './StyledComponents'

let Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export default class AlphabetPicker extends Component {
  constructor(props, context) {
    super(props, context)
    if (props.alphabet) {
      Alphabet = props.alphabet
    }
    this.state = {
      alphabet: Alphabet
    }
  }

  componentWillMount() {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gestureState) => {
        this.props.onTouchStart && this.props.onTouchStart()

        this.tapTimeout = setTimeout(() => {
          this._onTouchLetter(this._findTouchedLetter(gestureState.y0))
        }, 100)
      },
      onPanResponderMove: (evt, gestureState) => {
        clearTimeout(this.tapTimeout)
        this._onTouchLetter(this._findTouchedLetter(gestureState.moveY))
      },
      onPanResponderTerminate: this._onPanResponderEnd.bind(this),
      onPanResponderRelease: this._onPanResponderEnd.bind(this)
    })
  }
  componentWillReceiveProps(nextProps) {
    if (this.props.alphabet !== nextProps.alphabet) {
      this.setState({ alphabet: nextProps.alphabet })
    }
  }

  _onTouchLetter(letter) {
    letter && this.props.onTouchLetter && this.props.onTouchLetter(letter)
  }

  _onPanResponderEnd() {
    requestAnimationFrame(() => {
      this.props.onTouchEnd && this.props.onTouchEnd()
    })
  }

  _findTouchedLetter(y) {
    let top = y - (this.absContainerTop || 0)
    const { alphabet } = this.state

    if (top >= 1 && top <= this.containerHeight) {
      return alphabet[Math.round(top / this.containerHeight * alphabet.length)]
    }
  }

  _onLayout(event) {
    this.refs.alphabetContainer.measure((x1, y1, width, height, px, py) => {
      this.absContainerTop = py
      this.containerHeight = height
    })
  }

  render() {
    const { alphabet } = this.state
    this._letters = alphabet.map(letter => (
      <AlphabetLetter key={letter}>{letter}</AlphabetLetter>
    ))

    return (
      <View
        ref='alphabetContainer'
        {...this._panResponder.panHandlers}
        onLayout={this._onLayout.bind(this)}
        style={{
          paddingHorizontal: 5,
          justifyContent: 'center'
        }}
      >
        <View>{this._letters}</View>
      </View>
    )
  }
}
