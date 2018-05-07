import _ from 'lodash'
import invariant from 'fbjs/lib/invariant'

class FixedHeightListViewDataSource {
  constructor(params) {
    this._dataSource = []
    this._lookup = {}

    this._getHeightForSectionHeader = params.getHeightForSectionHeader
    this._getHeightForCell = params.getHeightForCell
  }

  computeRowsToRender(options) {
    let {
      scrollDirection,
      firstRendered,
      lastRendered,
      maxNumToRender,
      numToRenderAhead
    } = options

    invariant(
      numToRenderAhead < maxNumToRender,
      `numToRenderAhead must be less than maxNumToRender`
    )

    let numRendered = lastRendered - firstRendered + 1
    let lastRow, targetLastRow, firstRow, targetFirstRow

    if (scrollDirection === 'down') {
      let lastResult = this.__computeLastRow({ numRendered, ...options })
      lastRow = lastResult.lastRow
      targetLastRow = lastResult.targetLastRow
      let firstResult = this.__computeFirstRow({
        lastRow,
        numRendered,
        ...options
      })
      firstRow = firstResult.firstRow
      targetFirstRow = firstResult.targetFirstRow
    } else if (scrollDirection === 'up') {
      let firstResult = this.__computeFirstRow({ numRendered, ...options })
      firstRow = firstResult.firstRow
      targetFirstRow = firstResult.targetFirstRow
      let lastResult = this.__computeLastRow({
        firstRow,
        numRendered,
        ...options
      })
      lastRow = lastResult.lastRow
      targetLastRow = lastResult.targetLastRow
    }

    return { firstRow, lastRow, targetFirstRow, targetLastRow }
  }

  __computeFirstRow(options) {
    let {
      lastRow,
      firstVisible,
      maxNumToRender,
      numToRenderBehind,
      numToRenderAhead,
      firstRendered,
      scrollDirection,
      pageSize
    } = options

    let firstRow, targetFirstRow

    if (scrollDirection === 'down') {
      targetFirstRow = firstRow = Math.max(
        0,
        firstVisible - numToRenderBehind, // Never hide the first visible row
        lastRow - maxNumToRender // Don't exceed max to render
      )
    } else if (scrollDirection === 'up') {
      targetFirstRow = Math.max(
        0, // Don't render past the top
        firstVisible - numToRenderAhead + numToRenderBehind // Primary goal -- this is what we need lastVisible for
      )

      firstRow = Math.max(targetFirstRow, firstRendered - pageSize)
    }

    return { firstRow, targetFirstRow }
  }

  __computeLastRow(options) {
    let {
      firstVisible,
      firstRow,
      numRendered,
      lastVisible,
      totalRows,
      numToRenderBehind,
      numToRenderAhead,
      lastRendered,
      pageSize,
      maxNumToRender,
      scrollDirection
    } = options

    let lastRow, targetLastRow

    if (scrollDirection === 'down') {
      targetLastRow = Math.min(
        totalRows - 1, // Don't render past the bottom
        lastVisible + numToRenderAhead - numToRenderBehind, // Primary goal -- this is what we need lastVisible for
        firstVisible + numRendered + numToRenderAhead - numToRenderBehind // But don't exceed num to render ahead
      )

      lastRow = Math.min(targetLastRow, lastRendered + pageSize)
    } else if (scrollDirection === 'up') {
      targetLastRow = lastRow = lastRendered

      let numToBeRendered = lastRendered - firstRow
      if (numToBeRendered > maxNumToRender) {
        targetLastRow = lastRow =
          targetLastRow - (numToBeRendered - maxNumToRender)
      }
    }

    return { lastRow, targetLastRow }
  }

  getHeightBeforeRow(i) {
    let height = 0

    // console.log(this._lookup);
    _.forEach(this._lookup, (section, sectionId) => {
      if (i > section.range[0] && i <= section.range[1]) {
        height = height + section.sectionHeaderHeight
        height = height + (i - 1 - section.range[0]) * section.cellHeight
      } else if (section.range[0] < i) {
        height = height + section.height
      }
    })

    return height
  }

  hasSection(sectionId) {
    return !!this._lookup[sectionId]
  }

  getFirstRowOfSection(sectionId) {
    let range = this._lookup[sectionId].range
    let startY = this._lookup[sectionId].startY

    return {
      row: range[0],
      startY
    }
  }

  getHeightBetweenRows(i, ii) {
    if (ii < i) {
      console.warn('provide the lower index first')
    }

    return this.getHeightBeforeRow(ii) - this.getHeightBeforeRow(i + 1)
  }

  getHeightAfterRow(i) {
    return (
      this.getTotalHeight() - this.getHeightBeforeRow(i) - this.getRowHeight(i)
    )
  }

  computeVisibleRows(scrollY, viewportHeight) {
    let firstVisible = this.getRowAtHeight(scrollY)
    let lastVisible = this.getRowAtHeight(scrollY + viewportHeight) + 1

    return {
      firstVisible,
      lastVisible
    }
  }

  getRowCount() {
    return this._dataSource.length
  }

  getRowData(i) {
    return this._dataSource[i]
  }

  getRowAtHeight(scrollY) {
    if (scrollY < 0) {
      return 0
    } else if (scrollY > this.getTotalHeight()) {
      return Math.max(this.getRowCount() - 1, 0)
    }

    let parentSection = _.find(this._lookup, value => {
      return scrollY >= value.startY && scrollY <= value.endY
    })

    let relativeY = scrollY - parentSection.startY

    if (relativeY <= parentSection.sectionHeaderHeight) {
      return parentSection.range[0]
    }
    let i = Math.floor(
      (relativeY - parentSection.sectionHeaderHeight) / parentSection.cellHeight
    )
    return parentSection.range[0] + i
  }

  getRowHeight(i) {
    let row = this._dataSource[i]

    if (row && _.isObject(row) && row.sectionId) {
      return this.getSectionHeaderHeight(row.sectionId)
    }
    return this.getCellHeight(i)
  }

  getSectionHeaderHeight(sectionId) {
    return this._lookup[sectionId].sectionHeaderHeight
  }

  getCellHeight(i) {
    let parentSection = this.getParentSection(i)

    if (parentSection) {
      return parentSection.cellHeight
    }
  }

  getSectionId(i) {
    return this.getParentSection(i).sectionId
  }

  getParentSection(i) {
    return _.find(this._lookup, section => {
      return i >= section.range[0] && i <= section.range[1]
    })
  }

  getTotalHeight() {
    let keys = Object.keys(this._lookup)
    let lastSection = this._lookup[keys[keys.length - 1]]

    if (lastSection) {
      return lastSection.endY
    }
    return 0
  }

  cloneWithCellsAndSections(dataBlob, sectionIds = Object.keys(dataBlob)) {
    this._dataSource = []
    let sectionIdsPresent = []

    sectionIds.forEach(sectionId => {
      if (dataBlob[sectionId]) {
        this._dataSource.push({ sectionId }, ...dataBlob[sectionId])
        sectionIdsPresent.push(sectionId)
      }
    })

    let lastRow = -1
    let cumulativeHeight = 0
    this._lookup = sectionIdsPresent.reduce((result, sectionId) => {
      let sectionHeaderHeight = this._getHeightForSectionHeader(sectionId)
      let cellHeight = this._getHeightForCell(sectionId)
      let count = dataBlob[sectionId].length
      let sectionHeight = sectionHeaderHeight + cellHeight * count

      result[sectionId] = {
        count: count + 1, // Factor in section header
        range: [lastRow + 1, lastRow + 1 + count], // Move 1 ahead of previous last row
        height: sectionHeight,
        startY: cumulativeHeight,
        endY: cumulativeHeight + sectionHeight,
        cellHeight,
        sectionHeaderHeight,
        sectionId
      }

      cumulativeHeight = cumulativeHeight + sectionHeight
      lastRow = lastRow + 1 + count

      return result
    }, {})

    return this
  }

  getHeightOfSection(sectionId) {
    return this._lookup[sectionId].height
  }

  getSectionLengths() {
    let result = []
    _.forEach(this._lookup, value => {
      result.push(value.count)
    })
    return result
  }
}

module.exports = FixedHeightListViewDataSource
